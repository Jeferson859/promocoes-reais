const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

// Categorias para rotacionar a cada hora
const CATEGORIAS = [
    'MLB1055',  // Celulares
    'MLB1648',  // Computadores
    'MLB1000',  // Eletrônicos
    'MLB1144',  // TVs
    'MLB1246',  // Áudio
];

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
    const meliId = 'daje8667974';
    const appId  = '7346131242004348';

    // Rotaciona categoria pela hora atual
    const hora = new Date().getHours();
    const categoria = CATEGORIAS[hora % CATEGORIAS.length];
    console.log(`📂 Categoria: ${categoria} (hora ${hora})`);

    // 1. Pega highlights da categoria
    const resHL = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${categoria}`, { headers });
    const hlData = await resHL.json();
    const catalogIds = hlData.content.map(c => c.id);
    console.log(`📦 ${catalogIds.length} catálogos encontrados`);

    // Seleciona um catálogo diferente baseado nos minutos (muda a cada execução)
    const minutos = new Date().getMinutes();
    const idx = minutos % catalogIds.length;
    const catId = catalogIds[idx];
    console.log(`🎯 Catálogo selecionado: ${catId} (índice ${idx})`);

    // 2. Busca dados do produto no catálogo
    const resProd = await fetch(`https://api.mercadolibre.com/products/${catId}`, { headers });
    console.log(`📡 Product status: ${resProd.status}`);
    if (!resProd.ok) throw new Error(`Product ${catId} falhou: ${resProd.status}`);
    const prod = await resProd.json();

    // 3. Busca itens à venda desse catálogo
    const resItems = await fetch(`https://api.mercadolibre.com/products/${catId}/items`, { headers });
    console.log(`📡 Items status: ${resItems.status}`);

    let permalink = `https://www.mercadolivre.com.br/p/${catId}?matt_tool=${appId}&utm_campaign=${meliId}`;
    let preco = null;
    let precoOriginal = null;

    if (resItems.ok) {
        const itemsData = await resItems.json();
        if (itemsData.results && itemsData.results.length > 0) {
            const item = itemsData.results[0];
            preco = item.price;
            precoOriginal = item.original_price;
            // ✅ Link correto com afiliado
            if (item.permalink) {
                permalink = `${item.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`;
            }
        }
    }

    // Fallback de preço via buy_box_winner
    if (!preco && prod.buy_box_winner) {
        preco = prod.buy_box_winner.price;
    }

    if (!preco) throw new Error('Preço não encontrado para ' + catId);

    const imgUrl = (prod.pictures?.[0]?.url || '').replace('-O.jpg', '-J.jpg').replace('-I.jpg', '-J.jpg');

    return {
        title: prod.name,
        price: preco,
        original_price: precoOriginal,
        thumbnail: imgUrl,
        permalink: permalink
    };
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

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

        console.log(`✅ Produto: ${titulo} — R$ ${preco}`);
        console.log(`🔗 Link: ${p.permalink}`);

        await baixarImagem(p.thumbnail, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        let msg = `🔥 <b>OFERTA DO DIA!</b>\n\n<b>${titulo}</b>\n\n`;
        if (precoOriginal && desconto > 0) {
            msg += `<s>R$ ${precoOriginal}</s>\n`;
            msg += `💰 <b>R$ ${preco}</b> (${desconto}% OFF)\n\n`;
        } else {
            msg += `💰 <b>R$ ${preco}</b>\n\n`;
        }
        msg += `🛒 <a href="${p.permalink}">Compre aqui</a>`;

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
