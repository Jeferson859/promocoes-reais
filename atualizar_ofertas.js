const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const LOMADEE_SOURCE = '2324685';
const MELI_APP_ID    = '7346131242004348';
const MELI_ID        = 'daje8667974';

// ✅ Apenas lojas que funcionam de forma independente
// Submarino, Shoptime e Americanas foram removidas — redirecionam entre si
const OFERTAS = [
    { loja: 'Magazine Luiza', emoji: '🛍️',
      produto: 'whey protein',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'creatina', link: null },

    { loja: 'Kabum',          emoji: '💻',
      produto: 'smartwatch fitness',
      link: (q) => `https://www.kabum.com.br/busca/${enc(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'roupa fitness feminina', link: null },

    { loja: 'Magazine Luiza', emoji: '🛍️',
      produto: 'tênis de corrida',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'pré treino', link: null },

    { loja: 'Kabum',          emoji: '💻',
      produto: 'balança bioimpedância',
      link: (q) => `https://www.kabum.com.br/busca/${enc(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'suplemento hipercalórico', link: null },

    { loja: 'Magazine Luiza', emoji: '🛍️',
      produto: 'kit halteres',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'garrafa térmica academia', link: null }
];

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

async function buscarOfertaML(mlToken, produto) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const query = produto || 'suplementos fitness';
    const minutos = new Date().getUTCMinutes();

    // Faz a busca do produto
    const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${enc(query)}&limit=15`, { headers });
    if (!res.ok) throw new Error('Falha ao buscar no ML');
    
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('Nenhum produto encontrado');

    // Escolhe um produto do topo (rotativo por minuto) para ter variedade
    const item = data.results[minutos % Math.min(10, data.results.length)];

    const preco = item.price;
    const precoOriginal = item.original_price;
    const permalink = item.permalink ? `${item.permalink}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}` : '';
    
    // Pega a imagem de melhor qualidade se possível
    const img = (item.thumbnail || '').replace('-I.jpg','-J.jpg').replace('-O.jpg','-J.jpg');
    const desconto = precoOriginal ? Math.round(((precoOriginal - preco) / precoOriginal) * 100) : null;

    return { titulo: item.title, preco, precoOriginal, desconto, link: permalink, thumbnail: img };
}

async function buscarImagemML(mlToken, produto) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const query = produto || 'oferta';
    
    const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${enc(query)}&limit=1`, { headers });
    const data = await res.json();
    
    if (!data.results || data.results.length === 0) throw new Error('Imagem não encontrada');
    
    return data.results[0].thumbnail.replace('-I.jpg','-J.jpg').replace('-O.jpg','-J.jpg');
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não definidos!');
        process.exit(1);
    }

    try {
        const idx    = Math.floor(Date.now() / (30 * 60 * 1000)) % OFERTAS.length;
        const oferta = OFERTAS[idx];

        console.log(`🏪 Loja: ${oferta.loja} (índice ${idx})`);
        console.log(`📦 Produto: ${oferta.produto || 'via API ML'}`);

        const mlToken = await renovarTokenML();
        let resultado;

        if (oferta.loja === 'Mercado Livre') {
            resultado = await buscarOfertaML(mlToken, oferta.produto);
        } else {
            const link      = oferta.link(oferta.produto);
            const thumbnail = await buscarImagemML(mlToken, oferta.produto);
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
