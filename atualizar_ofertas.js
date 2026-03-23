const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const LOMADEE_SOURCE = '2324685';
const MELI_APP_ID    = '7346131242004348';
const MELI_ID        = 'daje8667974';

// Cada entrada tem loja + produto fixo — sempre combinam!
const OFERTAS = [
    { loja: 'Magazine Luiza', emoji: '🛍️', produto: 'iphone 15',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null }, // usa API

    { loja: 'Americanas',     emoji: '🔴', produto: 'samsung galaxy s24',
      link: (q) => `https://www.americanas.com.br/busca/${enc(q)}?chave=afl_${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Kabum',          emoji: '💻', produto: 'notebook gamer',
      link: (q) => `https://www.kabum.com.br/busca/${enc(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Submarino',      emoji: '🚢', produto: 'tv 4k 55',
      link: (q) => `https://www.submarino.com.br/busca/${enc(q)}?chave=afl_${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Shoptime',       emoji: '🛒', produto: 'airfryer philips',
      link: (q) => `https://www.shoptime.com.br/busca/${enc(q)}?chave=afl_${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Magazine Luiza', emoji: '🛍️', produto: 'smartwatch',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Americanas',     emoji: '🔴', produto: 'headphone bluetooth',
      link: (q) => `https://www.americanas.com.br/busca/${enc(q)}?chave=afl_${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Kabum',          emoji: '💻', produto: 'monitor gamer',
      link: (q) => `https://www.kabum.com.br/busca/${enc(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Magazine Luiza', emoji: '🛍️', produto: 'geladeira frost free',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },

    { loja: 'Submarino',      emoji: '🚢', produto: 'kindle',
      link: (q) => `https://www.submarino.com.br/busca/${enc(q)}?chave=afl_${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: null, link: null },
];

const CATEGORIAS_ML = ['MLB1055','MLB1648','MLB1000','MLB1144','MLB1246'];

function enc(q) { return encodeURIComponent(q); }

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

async function renovarTokenML() {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${process.env.MELI_CLIENT_ID}&client_secret=${process.env.MELI_CLIENT_SECRET}&refresh_token=${process.env.ML_REFRESH}`
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Token ML falhou: ' + JSON.stringify(data));
    console.log('✅ Token ML renovado!');
    return data.access_token;
}

async function buscarOfertaML(mlToken) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const hora    = new Date().getUTCHours();
    const minutos = new Date().getUTCMinutes();
    const cat     = CATEGORIAS_ML[hora % CATEGORIAS_ML.length];

    const resHL = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${cat}`, { headers });
    const hlData = await resHL.json();
    const ids    = hlData.content.map(c => c.id);
    const catId  = ids[minutos % ids.length];

    const resProd = await fetch(`https://api.mercadolibre.com/products/${catId}`, { headers });
    if (!resProd.ok) throw new Error(`Product ${catId} falhou`);
    const prod = await resProd.json();

    const resItems = await fetch(`https://api.mercadolibre.com/products/${catId}/items`, { headers });
    let preco = null, precoOriginal = null;
    let permalink = `https://www.mercadolivre.com.br/p/${catId}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;

    if (resItems.ok) {
        const d = await resItems.json();
        if (d.results?.length > 0) {
            const item = d.results[0];
            preco = item.price;
            precoOriginal = item.original_price;
            if (item.permalink) permalink = `${item.permalink}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
        }
    }

    if (!preco && prod.buy_box_winner) preco = prod.buy_box_winner.price;
    if (!preco) throw new Error('Preço não encontrado');

    const img = (prod.pictures?.[0]?.url || '').replace('-O.jpg','-J.jpg').replace('-I.jpg','-J.jpg');
    const desconto = precoOriginal ? Math.round(((precoOriginal - preco) / precoOriginal) * 100) : null;

    return { titulo: prod.name, preco, precoOriginal, desconto, link: permalink, thumbnail: img };
}

async function buscarImagemML(mlToken) {
    try {
        const headers = { 'Authorization': `Bearer ${mlToken}` };
        const hora = new Date().getUTCHours();
        const cat  = CATEGORIAS_ML[hora % CATEGORIAS_ML.length];
        const resHL = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${cat}`, { headers });
        const hlData = await resHL.json();
        const catId = hlData.content[0]?.id;
        const resProd = await fetch(`https://api.mercadolibre.com/products/${catId}`, { headers });
        const prod = await resProd.json();
        return (prod.pictures?.[0]?.url || '').replace('-O.jpg','-J.jpg').replace('-I.jpg','-J.jpg');
    } catch(e) {
        throw new Error('Imagem não encontrada: ' + e.message);
    }
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não definidos!');
        process.exit(1);
    }

    try {
        // Índice baseado no número de execuções de 30 min desde epoch
        const idx    = Math.floor(Date.now() / (30 * 60 * 1000)) % OFERTAS.length;
        const oferta = OFERTAS[idx];

        console.log(`🏪 Loja: ${oferta.loja} (índice ${idx})`);
        console.log(`📦 Produto: ${oferta.produto || 'via API ML'}`);

        const mlToken = await renovarTokenML();
        let resultado;

        if (oferta.loja === 'Mercado Livre') {
            // Busca produto e preço real via API
            resultado = await buscarOfertaML(mlToken);
        } else {
            // Loja Lomadee — monta deep link com produto fixo da entrada
            const link      = oferta.link(oferta.produto);
            const thumbnail = await buscarImagemML(mlToken);
            resultado = {
                titulo: oferta.produto.toUpperCase(),
                preco: null,
                precoOriginal: null,
                desconto: null,
                link,
                thumbnail
            };
        }

        console.log(`🔗 Link: ${resultado.link}`);

        await baixarImagem(resultado.thumbnail, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        // Monta mensagem
        let msg = `${oferta.emoji} <b>${oferta.loja.toUpperCase()}</b>\n`;
        msg += `━━━━━━━━━━━━━━━\n`;
        msg += `🔥 <b>OFERTA DO DIA!</b>\n\n`;
        msg += `<b>${resultado.titulo}</b>\n\n`;

        if (resultado.preco) {
            const precoFmt = resultado.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            if (resultado.precoOriginal && resultado.desconto > 0) {
                const origFmt = resultado.precoOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                msg += `<s>R$ ${origFmt}</s>\n`;
                msg += `💰 <b>R$ ${precoFmt}</b> (${resultado.desconto}% OFF)\n\n`;
            } else {
                msg += `💰 <b>R$ ${precoFmt}</b>\n\n`;
            }
        } else {
            msg += `💰 <b>Clique e veja o melhor preço!</b>\n\n`;
        }

        msg += `🛒 <a href="${resultado.link}">Compre aqui</a>`;

        fs.writeFileSync('msg.txt', msg);

        const cmd = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" \
            -F chat_id="${chatId}" \
            -F photo="@foto.jpg" \
            -F caption="$(cat msg.txt)" \
            -F parse_mode="HTML"`;

        const res  = execSync(cmd).toString();
        const json = JSON.parse(res);

        if (json.ok) {
            console.log('✅ Postado com sucesso!');
        } else {
            throw new Error('Telegram recusou: ' + JSON.stringify(json));
        }

    } catch (e) {
        console.error('❌ Erro: ' + e.message);
        process.exit(1);
    }
}

iniciar();
