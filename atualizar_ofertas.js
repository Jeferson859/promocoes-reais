const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

function baixarImagem(url, destino) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destino);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                https.get(response.headers.location, (res2) => {
                    res2.pipe(file);
                    file.on('finish', () => { file.close(); resolve(); });
                    file.on('error', reject);
                }).on('error', reject);
            } else {
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
                file.on('error', reject);
            }
        }).on('error', reject);
    });
}

async function renovarToken() {
    const clientId     = process.env.MELI_CLIENT_ID;
    const clientSecret = process.env.MELI_CLIENT_SECRET;
    const refreshToken = process.env.ML_REFRESH;

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Token falhou: ' + JSON.stringify(data));
    console.log('✅ Token renovado!');
    return data.access_token;
}

async function buscarProduto(mlToken) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };

    // Tenta endpoint de tendências (menos bloqueado)
    const endpoints = [
        'https://api.mercadolibre.com/trends/MLB',
        'https://api.mercadolibre.com/highlights/MLB',
        'https://api.mercadolibre.com/sites/MLB/featured_events',
    ];

    // Busca item pelo ID de tendência
    console.log('🔍 Buscando tendências...');
    const resTrends = await fetch(endpoints[0], { headers });
    console.log(`📡 Trends status: ${resTrends.status}`);

    if (resTrends.ok) {
        const trends = await resTrends.json();
        console.log('Tendências:', JSON.stringify(trends).slice(0, 200));

        if (Array.isArray(trends) && trends.length > 0) {
            const keyword = trends[0].keyword || trends[0];
            console.log(`🔑 Buscando por: ${keyword}`);

            const resSearch = await fetch(
                `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(keyword)}&limit=1`,
                { headers }
            );
            console.log(`📡 Search status: ${resSearch.status}`);

            if (resSearch.ok) {
                const searchData = await resSearch.json();
                if (searchData.results && searchData.results.length > 0) {
                    return searchData.results[0];
                }
            }
        }
    }

    // Fallback: busca por item específico via ID
    console.log('🔄 Tentando busca por categoria...');
    const resCat = await fetch(
        'https://api.mercadolibre.com/sites/MLB/search?category=MLB1055&limit=1&sort=relevance',
        { headers }
    );
    console.log(`📡 Category status: ${resCat.status}`);
    const catData = await resCat.json();
    console.log('Resposta categoria:', JSON.stringify(catData).slice(0, 300));

    if (catData.results && catData.results.length > 0) return catData.results[0];

    throw new Error('Nenhum produto encontrado em nenhum endpoint.');
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const meliId = 'daje8667974';
    const appId  = '7346131242004348';

    if (!token || !chatId) {
        console.error('❌ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não definidos!');
        process.exit(1);
    }

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
