const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

function baixarImagem(url, destino) {
    return new Promise((resolve, reject) => {
        const req = (u) => https.get(u, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) return req(res.headers.location);
            const file = fs.createWriteStream(destino);
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

    // 1. Pega highlights
    console.log('📈 Buscando highlights...');
    const resHL = await fetch('https://api.mercadolibre.com/highlights/MLB/category/MLB1055', { headers });
    const hlData = await resHL.json();
    const ids = hlData.content.map(c => c.id).slice(0, 5);
    console.log(`📦 IDs: ${ids.join(', ')}`);

    // 2. Busca itens em lote
    const resItems = await fetch(`https://api.mercadolibre.com/items?ids=${ids.join(',')}`, { headers });
    const itemsRaw = await resItems.json();

    // DEBUG: mostra estrutura do primeiro item
    console.log('Estrutura item[0]:', JSON.stringify(itemsRaw[0]).slice(0, 400));

    // 3. Extrai itens — a API retorna array direto ou com body
    const itens = itemsRaw
        .map(r => r.body || r)
        .filter(i => i && i.price && i.title);

    console.log(`✅ ${itens.length} itens válidos`);
    if (itens.length === 0) throw new Error('Nenhum item válido');

    // 4. Pega o de maior desconto
    return itens.reduce((m, a) => {
        const dA = a.original_price ? (a.original_price - a.price) / a.original_price : 0;
        const dM = m.original_price ? (m.original_price - m.price) / m.original_price : 0;
        return dA > dM ? a : m;
    });
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
        const preco         = p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const precoOriginal = p.original_price
            ? p.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            : null;
        const desconto = p.original_price
            ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
            : null;
        const link   = `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`;
        const imgUrl = p.thumbnail.replace('-I.jpg', '-J.jpg');

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
