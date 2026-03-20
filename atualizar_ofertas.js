const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

function baixarImagem(url, destino) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destino);
        const req = (u) => https.get(u, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) return req(res.headers.location);
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', reject);
        }).on('error', reject);
        req(url);
    });
}

async function renovarToken() {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${process.env.MELI_CLIENT_ID}&client_secret=${process.env.MELI_CLIENT_SECRET}&refresh_token=${process.env.ML_REFRESH}`
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Token falhou: ' + JSON.stringify(data));
    console.log('✅ Token renovado!');
    return data.access_token;
}

async function buscarProduto(mlToken) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };

    // 1. Pega tendências (retorna 200 ✅)
    console.log('📈 Buscando tendências...');
    const resTrends = await fetch('https://api.mercadolibre.com/trends/MLB', { headers });
    const trends = await resTrends.json();
    console.log(`📊 ${trends.length} tendências encontradas`);

    // 2. Para cada tendência, tenta pegar o item direto pela URL da tendência
    for (const trend of trends.slice(0, 5)) {
        const keyword = trend.keyword;
        console.log(`🔍 Tentando: ${keyword}`);

        // Busca usando o endpoint de multiget por keyword via highlights
        const resHL = await fetch(
            `https://api.mercadolibre.com/highlights/MLB/category/MLB1055`,
            { headers }
        );
        console.log(`📡 Highlights status: ${resHL.status}`);

        if (resHL.ok) {
            const hlData = await resHL.json();
            console.log('Highlights:', JSON.stringify(hlData).slice(0, 300));

            if (hlData.content && hlData.content.length > 0) {
                const itemId = hlData.content[0];
                const resItem = await fetch(`https://api.mercadolibre.com/items/${itemId}`, { headers });
                console.log(`📡 Item status: ${resItem.status}`);
                if (resItem.ok) {
                    const item = await resItem.json();
                    return item;
                }
            }
        }
        break;
    }

    // 3. Fallback: busca item diretamente por ID conhecido
    console.log('🔄 Tentando item direto...');
    const resItem = await fetch('https://api.mercadolibre.com/items/MLB1414881315', { headers });
    console.log(`📡 Item direto status: ${resItem.status}`);
    if (resItem.ok) {
        const item = await resItem.json();
        console.log('Item:', item.title);
        return item;
    }

    throw new Error('Todos os endpoints falharam');
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const meliId = 'daje8667974';
    const appId  = '7346131242004348';

    try {
        const mlToken = await renovarToken();
        const p = await buscarProduto(mlToken);

        const titulo        = p.title;
        const preco         = (p.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const precoOriginal = p.original_price
            ? p.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            : null;
        const desconto = p.original_price
            ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
            : null;
        const link   = `https://www.mercadolivre.com.br/p/${p.id}?matt_tool=${appId}&utm_campaign=${meliId}`;
        const imgUrl = (p.thumbnail || p.pictures?.[0]?.url || '').replace('-I.jpg', '-J.jpg');

        console.log(`✅ Produto: ${titulo} — R$ ${preco}`);

        await baixarImagem(imgUrl, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        let msg = `🔥 <b>OFERTA DO DIA!</b>\n\n<b>${titulo}</b>\n\n`;
        if (precoOriginal && desconto > 0) {
            msg += `<s>R$ ${precoOriginal}</s>\n`;
            msg += `💰 <b>R$ ${preco}</b> (${desconto}% OFF)\n\n`;
        } else {
            msg += `💰 <b>R$ ${preco}</b>\n\n`;
        }
        msg += `🛒 <b>Compre aqui:</b>\n${link}`;

        fs.writeFileSync('msg.txt', msg);

        const comando = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" \
            -F chat_id="${chatId}" \
            -F photo="@foto.jpg" \
            -F caption="$(cat msg.txt)" \
            -F parse_mode="HTML"`;

        const resultado = execSync(comando).toString();
        const json = JSON.parse(resultado);

        if (json.ok) {
            console.log('✅ Postado com sucesso no Telegram!');
        } else {
            throw new Error('Telegram recusou: ' + JSON.stringify(json));
        }

    } catch (e) {
        console.error('❌ Erro: ' + e.message);
        process.exit(1);
    }
}

iniciar();
