const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

// =============================================
// CONFIGURAÇÕES
// =============================================
const LOMADEE_SOURCE = '2324685';
const MELI_APP_ID    = '7346131242004348';
const MELI_ID        = 'daje8667974';

// Lojas com deep link de afiliado Lomadee
const LOJAS = [
    {
        nome: 'Magazine Luiza',
        emoji: '🛍️',
        cor: 'magalu',
        busca: (q) => `https://www.magazineluiza.com.br/busca/${encodeURIComponent(q)}/?partner_id=${LOMADEE_SOURCE}&source_id=${LOMADEE_SOURCE}`,
        thumb: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Magazine_Luiza_logo.svg/200px-Magazine_Luiza_logo.svg.png'
    },
    {
        nome: 'Americanas',
        emoji: '🔴',
        cor: 'americanas',
        busca: (q) => `https://www.americanas.com.br/busca/${encodeURIComponent(q)}?chave=afl_${LOMADEE_SOURCE}`,
        thumb: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Americanas_logo.svg/200px-Americanas_logo.svg.png'
    },
    {
        nome: 'Submarino',
        emoji: '🚢',
        cor: 'submarino',
        busca: (q) => `https://www.submarino.com.br/busca/${encodeURIComponent(q)}?chave=afl_${LOMADEE_SOURCE}`,
        thumb: null
    },
    {
        nome: 'Shoptime',
        emoji: '🛒',
        cor: 'shoptime',
        busca: (q) => `https://www.shoptime.com.br/busca/${encodeURIComponent(q)}?chave=afl_${LOMADEE_SOURCE}`,
        thumb: null
    },
    {
        nome: 'Kabum',
        emoji: '💻',
        cor: 'kabum',
        busca: (q) => `https://www.kabum.com.br/busca/${encodeURIComponent(q)}?utm_source=lomadee&utm_medium=afiliados&sourceId=${LOMADEE_SOURCE}`,
        thumb: null
    },
    {
        nome: 'Mercado Livre',
        emoji: '🟡',
        cor: 'mercadolivre',
        busca: null // usa API própria
    },
];

// Produtos em alta para buscar nas lojas
const PRODUTOS = [
    'iphone 15',
    'samsung galaxy s24',
    'notebook gamer',
    'tv 4k 55',
    'airfryer',
    'headphone bluetooth',
    'smartwatch',
    'geladeira frost free',
    'tablet',
    'monitor gamer',
    'cadeira gamer',
    'micro-ondas',
    'kindle',
    'playstation 5',
    'xbox series',
];

// Categorias ML para rotacionar
const CATEGORIAS_ML = ['MLB1055','MLB1648','MLB1000','MLB1144','MLB1246'];

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
    const hora = new Date().getHours();
    const minutos = new Date().getMinutes();
    const categoria = CATEGORIAS_ML[hora % CATEGORIAS_ML.length];

    const resHL = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${categoria}`, { headers });
    const hlData = await resHL.json();
    const catalogIds = hlData.content.map(c => c.id);
    const catId = catalogIds[minutos % catalogIds.length];

    const resProd = await fetch(`https://api.mercadolibre.com/products/${catId}`, { headers });
    if (!resProd.ok) throw new Error(`Product ${catId} falhou`);
    const prod = await resProd.json();

    const resItems = await fetch(`https://api.mercadolibre.com/products/${catId}/items`, { headers });
    let preco = null, precoOriginal = null;
    let permalink = `https://www.mercadolivre.com.br/p/${catId}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;

    if (resItems.ok) {
        const itemsData = await resItems.json();
        if (itemsData.results?.length > 0) {
            const item = itemsData.results[0];
            preco = item.price;
            precoOriginal = item.original_price;
            if (item.permalink) permalink = `${item.permalink}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
        }
    }

    if (!preco && prod.buy_box_winner) preco = prod.buy_box_winner.price;
    if (!preco) throw new Error('Preço não encontrado');

    const imgUrl = (prod.pictures?.[0]?.url || '').replace('-O.jpg','-J.jpg').replace('-I.jpg','-J.jpg');
    const desconto = precoOriginal ? Math.round(((precoOriginal - preco) / precoOriginal) * 100) : null;

    return {
        titulo: prod.name,
        preco,
        precoOriginal,
        desconto,
        link: permalink,
        thumbnail: imgUrl,
        loja: LOJAS.find(l => l.cor === 'mercadolivre')
    };
}

async function buscarOfertaLoja(loja, produto) {
    // Busca thumbnail do produto via DuckDuckGo Images (sem API)
    // Usa imagem do ML como fallback via API pública de imagens
    const link = loja.busca(produto);

    // Tenta pegar imagem do produto no ML para ilustrar
    let thumbnail = null;
    try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(produto)}&limit=1`);
        if (res.ok) {
            const data = await res.json();
            if (data.results?.length > 0) {
                thumbnail = data.results[0].thumbnail.replace('-I.jpg', '-J.jpg');
            }
        }
    } catch(e) {}

    return {
        titulo: `🔥 ${produto.toUpperCase()} - Melhores Ofertas`,
        preco: null, // sem preço fixo pois é deep link
        precoOriginal: null,
        desconto: null,
        link,
        thumbnail,
        loja
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
        // Rotaciona loja e produto pelo timestamp atual
        const agora = Date.now();
        const idxLoja    = Math.floor(agora / (30 * 60 * 1000)) % LOJAS.length;
        const idxProduto = Math.floor(agora / (30 * 60 * 1000)) % PRODUTOS.length;

        const loja    = LOJAS[idxLoja];
        const produto = PRODUTOS[idxProduto];

        console.log(`🏪 Loja: ${loja.nome}`);
        console.log(`📦 Produto: ${produto}`);

        let oferta;

        if (loja.cor === 'mercadolivre') {
            // Usa API do ML com preço real
            const mlToken = await renovarTokenML();
            oferta = await buscarOfertaML(mlToken);
        } else {
            // Usa deep link Lomadee
            oferta = await buscarOfertaLoja(loja, produto);
        }

        console.log(`🔗 Link: ${oferta.link}`);

        // Baixa imagem
        if (oferta.thumbnail) {
            await baixarImagem(oferta.thumbnail, 'foto.jpg');
            console.log('📸 Imagem baixada!');
        } else {
            // Cria imagem placeholder se não tiver
            execSync(`curl -s "https://via.placeholder.com/400x400.jpg?text=${encodeURIComponent(loja.nome)}" -o foto.jpg`);
        }

        // Monta mensagem
        let msg = `${loja.emoji} <b>${loja.nome.toUpperCase()}</b>\n`;
        msg += `━━━━━━━━━━━━━━━━\n`;
        msg += `🔥 <b>OFERTA DO DIA!</b>\n\n`;
        msg += `<b>${oferta.titulo}</b>\n\n`;

        if (oferta.preco) {
            const precoFmt = oferta.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            if (oferta.precoOriginal && oferta.desconto > 0) {
                const origFmt = oferta.precoOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                msg += `<s>R$ ${origFmt}</s>\n`;
                msg += `💰 <b>R$ ${precoFmt}</b> (${oferta.desconto}% OFF)\n\n`;
            } else {
                msg += `💰 <b>R$ ${precoFmt}</b>\n\n`;
            }
        } else {
            msg += `💰 <b>Clique para ver o preço!</b>\n\n`;
        }

        msg += `🛒 <a href="${oferta.link}">Compre aqui</a>`;

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
