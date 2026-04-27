const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const LOMADEE_SOURCE = '2324685';
const MELI_APP_ID    = '7346131242004348';
const MELI_ID        = 'daje8667974';

// ✅ Focando 100% no Mercado Livre, pois é a única loja com API oficial
// que nos fornece o preço real, os descontos e a imagem verdadeira do produto em tempo real.
const OFERTAS = [
    { loja: 'Mercado Livre', emoji: '🟡', produto: 'fitness', link: null }
];

// Categorias focadas em fitness no ML
// MLB2438 = Suplementos, MLB55255 = Roupas Esportivas, MLB35235 = Musculação, MLB12711 = Esportes Geral, MLB15250 = Tênis Esportivos
const CATEGORIAS_FITNESS_ML = ['MLB2438', 'MLB55255', 'MLB35235', 'MLB12711', 'MLB15250'];

function enc(q) { return encodeURIComponent(q); }

async function baixarImagem(url, destino) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) {
        throw new Error(`O download da imagem falhou com status ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
        throw new Error('A imagem baixada está vazia (0 bytes)');
    }
    fs.writeFileSync(destino, buffer);
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
    const hora    = new Date().getUTCHours();
    const minutos = new Date().getUTCMinutes();
    const cat     = CATEGORIAS_FITNESS_ML[hora % CATEGORIAS_FITNESS_ML.length];

    // Usa a API de Busca padrão (que nunca dá 404) em vez da de highlights
    const resBusca  = await fetch(`https://api.mercadolibre.com/sites/MLB/search?category=${cat}&limit=50`, { headers });
    
    if (!resBusca.ok) {
        throw new Error(`Falha ao buscar produtos na categoria (${resBusca.status})`);
    }
    
    const buscaData = await resBusca.json();
    if (!buscaData.results || buscaData.results.length === 0) {
        throw new Error('Nenhum item encontrado na busca');
    }
    
    const ids    = buscaData.results.map(c => c.id);
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

        let resultado;

        if (oferta.loja === 'Mercado Livre') {
            const mlToken = await renovarTokenML();
            resultado = await buscarOfertaML(mlToken, oferta.produto);
        } else {
            const link      = oferta.link(oferta.produto);
            const thumbnail = oferta.imagem_fixa; // Usamos a imagem direta do produto
            
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
            -F caption="<msg.txt" \
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
        
        // Tenta enviar o erro para o Telegram para facilitar o diagnóstico
        try {
            const t = process.env.TELEGRAM_TOKEN;
            const c = process.env.TELEGRAM_CHAT_ID;
            if (t && c) {
                const msgErro = `⚠️ <b>O Bot encontrou um erro:</b>\n\n${e.message}\n\n<i>Se o erro for sobre o Token do ML, será necessário gerar um novo refresh_token.</i>`;
                execSync(`curl -s -X POST "https://api.telegram.org/bot${t}/sendMessage" -F chat_id="${c}" -F text="${msgErro}" -F parse_mode="HTML"`);
            }
        } catch(err2) {}

        process.exit(1);
    }
}

iniciar();
