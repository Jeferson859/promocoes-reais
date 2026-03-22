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

    // 1. Pega highlights — retorna IDs de catálogo (ex: MLB57767498)
    console.log('📈 Buscando highlights...');
    const resHL = await fetch('https://api.mercadolibre.com/highlights/MLB/category/MLB1055', { headers });
    const hlData = await resHL.json();
    const catalogIds = hlData.content.map(c => c.id).slice(0, 3);
    console.log(`📦 Catálogos: ${catalogIds.join(', ')}`);

    // 2. Para cada catálogo, busca o produto via /products/{id}
    for (const catId of catalogIds) {
        console.log(`🔍 Buscando produto do catálogo ${catId}...`);
        const resProd = await fetch(`https://api.mercadolibre.com/products/${catId}`, { headers });
        console.log(`📡 Product status: ${resProd.status}`);

        if (resProd.ok) {
            const prod = await resProd.json();
            console.log(`📦 Produto: ${prod.name}`);

            // 3. Busca o item à venda com melhor preço via buy_box_winner
            const resBuy = await fetch(`https://api.mercadolibre.com/products/${catId}/items`, { headers });
            console.log(`📡 Items status: ${resBuy.status}`);

            if (resBuy.ok) {
                const buyData = await resBuy.json();
                console.log('Buy data:', JSON.stringify(buyData).slice(0, 300));

                if (buyData.results && buyData.results.length > 0) {
                    const item = buyData.results[0];
                    return {
                        title: prod.name || item.title,
                        price: item.price,
                        original_price: item.original_price,
                        thumbnail: prod.pictures?.[0]?.url || item.thumbnail,
                        permalink: item.permalink
                    };
                }
            }

            // Fallback: usa dados do próprio produto do catálogo
            if (prod.buy_box_winner) {
                return {
                    title: prod.name,
                    price: prod.buy_box_winner.price,
                    original_price: null,
                    thumbnail: prod.pictures?.[0]?.url,
                    permalink: `https://www.mercadolivre.com.br/p/${catId}`
                };
            }
        }
    }

    throw new Error('Nenhum produto encontrado nos catálogos');
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
        const imgUrl = (p.thumbnail || '').replace('-I.jpg', '-J.jpg');

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
