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
      imagem_fixa: 'https://a-static.mlcdn.com.br/800x560/whey-protein-100-puro-sabor-chocolate-900g-integralmedica/suplementosbaratos/372/295c52c2122b5125dd280a56f21c258f.jpg',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'fitness', link: null },

    { loja: 'Kabum',          emoji: '💻',
      produto: 'smartwatch fitness',
      imagem_fixa: 'https://images.kabum.com.br/produtos/fotos/384725/smartwatch-samsung-galaxy-watch5-pro-bt-45mm-tela-sapphire-amoled-1-36-bluetooth-preto-sm-r920nzkazto_1660139194_gg.jpg',
      link: (q) => `https://www.kabum.com.br/busca/${enc(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'fitness', link: null },

    { loja: 'Magazine Luiza', emoji: '🛍️',
      produto: 'tênis de corrida',
      imagem_fixa: 'https://a-static.mlcdn.com.br/800x560/tenis-esportivo-corrida-academia-original-macio-e-confortavel/allfeet/010marinho-43/4523bb8c7b8dfa5ed56d817b1bf762dd.jpeg',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'fitness', link: null },

    { loja: 'Kabum',          emoji: '💻',
      produto: 'balança bioimpedância',
      imagem_fixa: 'https://images.kabum.com.br/produtos/fotos/471015/balanca-de-bioimpedancia-digital-com-bluetooth-e-app-preta_1688647565_gg.jpg',
      link: (q) => `https://www.kabum.com.br/busca/${enc(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'fitness', link: null },

    { loja: 'Magazine Luiza', emoji: '🛍️',
      produto: 'kit halteres',
      imagem_fixa: 'https://a-static.mlcdn.com.br/800x560/kit-2-halteres-de-1kg-fita-de-suspensao-trilha-esporte/magazineluiza/225330800/d7e178ff06c59a35e40638ff408cdd6a.jpg',
      link: (q) => `https://www.magazineluiza.com.br/busca/${enc(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}` },

    { loja: 'Mercado Livre',  emoji: '🟡', produto: 'fitness', link: null }
];

// Categorias focadas em fitness no ML
// MLB2438 = Suplementos, MLB55255 = Roupas Esportivas, MLB35235 = Musculação, MLB12711 = Esportes Geral, MLB15250 = Tênis Esportivos
const CATEGORIAS_FITNESS_ML = ['MLB2438', 'MLB55255', 'MLB35235', 'MLB12711', 'MLB15250'];

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
    const hora    = new Date().getUTCHours();
    const minutos = new Date().getUTCMinutes();
    const cat     = CATEGORIAS_FITNESS_ML[hora % CATEGORIAS_FITNESS_ML.length];

    // Volta a usar a API de Highlights que é permitida para bots
    let resHL  = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${cat}`, { headers });
    
    // Se a subcategoria não tem destaques (ex: MLB2438 dá 404), usamos a categoria PAI (Esportes e Fitness)
    if (!resHL.ok) {
        resHL = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/MLB12711`, { headers });
    }
    
    if (!resHL.ok) throw new Error(`Falha ao buscar highlights (${resHL.status})`);
    
    const hlData = await resHL.json();
    if (!hlData.content || hlData.content.length === 0) {
        throw new Error('Nenhum item encontrado no highlights da categoria');
    }
    
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
