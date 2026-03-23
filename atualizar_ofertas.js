const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const LOMADEE_SOURCE  = '2324685';
const LOMADEE_TOKEN   = 'mMxCxyI6u2AKiIDY9v27zMUiUKBfQvm_';
const MELI_APP_ID     = '7346131242004348';
const MELI_ID         = 'daje8667974';

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

// Busca cupons do Lomadee para uma loja
async function buscarCupomLomadee(nomeLoja) {
    try {
        const url = `https://api.lomadee.com/v3/${LOMADEE_TOKEN}/coupon/_search?sourceId=${LOMADEE_SOURCE}&size=5`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();

        if (!data.coupons || data.coupons.length === 0) return null;

        // Tenta achar cupom da loja do produto
        const cupom = data.coupons.find(c =>
            nomeLoja && c.store?.name?.toLowerCase().includes(nomeLoja.toLowerCase())
        ) || data.coupons[0]; // fallback: primeiro cupom disponível

        return cupom ? {
            codigo: cupom.code,
            descricao: cupom.description,
            loja: cupom.store?.name,
            validade: cupom.vigency
        } : null;
    } catch (e) {
        console.log('⚠️ Lomadee erro: ' + e.message);
        return null;
    }
}

// Busca oferta do Lomadee diretamente
async function buscarOfertaLomadee() {
    try {
        console.log('🔍 Buscando oferta no Lomadee...');
        const url = `https://api.lomadee.com/v3/${LOMADEE_TOKEN}/offer/_search?sourceId=${LOMADEE_SOURCE}&size=5`;
        const res = await fetch(url);
        console.log(`📡 Lomadee offers status: ${res.status}`);
        if (!res.ok) return null;

        const data = await res.json();
        if (!data.offers || data.offers.length === 0) return null;

        // Pega oferta com maior desconto
        const oferta = data.offers.reduce((m, a) => {
            const dA = a.discount || 0;
            const dM = m.discount || 0;
            return dA > dM ? a : m;
        });

        console.log(`✅ Lomadee oferta: ${oferta.name}`);
        return {
            titulo: oferta.name,
            preco: oferta.price,
            precoOriginal: oferta.priceFrom || null,
            link: oferta.link,
            thumbnail: oferta.thumbnail,
            loja: oferta.store?.name || 'Loja parceira',
            desconto: oferta.discount || null,
            fonte: 'lomadee'
        };
    } catch (e) {
        console.log('⚠️ Lomadee oferta erro: ' + e.message);
        return null;
    }
}

async function buscarOfertaML(mlToken) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const hora = new Date().getHours();
    const minutos = new Date().getMinutes();
    const categoria = CATEGORIAS_ML[hora % CATEGORIAS_ML.length];

    console.log(`📂 ML Categoria: ${categoria}`);
    const resHL = await fetch(`https://api.mercadolibre.com/highlights/MLB/category/${categoria}`, { headers });
    const hlData = await resHL.json();
    const catalogIds = hlData.content.map(c => c.id);

    const idx = minutos % catalogIds.length;
    const catId = catalogIds[idx];
    console.log(`🎯 Catálogo: ${catId}`);

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

    const imgUrl = (prod.pictures?.[0]?.url || '').replace('-O.jpg', '-J.jpg').replace('-I.jpg', '-J.jpg');
    const desconto = precoOriginal ? Math.round(((precoOriginal - preco) / precoOriginal) * 100) : null;

    return {
        titulo: prod.name,
        preco,
        precoOriginal,
        link: permalink,
        thumbnail: imgUrl,
        loja: 'Mercado Livre',
        desconto,
        fonte: 'mercadolivre'
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
        // Alterna entre Lomadee e Mercado Livre a cada execução
        const minutos = new Date().getMinutes();
        let oferta = null;

        if (minutos % 2 === 0) {
            // Tenta Lomadee primeiro nos minutos pares
            oferta = await buscarOfertaLomadee();
        }

        if (!oferta) {
            // Fallback ou minutos ímpares: usa Mercado Livre
            const mlToken = await renovarTokenML();
            oferta = await buscarOfertaML(mlToken);
        }

        // Busca cupom do Lomadee para a loja do produto
        const cupom = await buscarCupomLomadee(oferta.loja);
        if (cupom) {
            console.log(`🎟️ Cupom encontrado: ${cupom.codigo}`);
        }

        const precoFmt = oferta.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const precoOrigFmt = oferta.precoOriginal
            ? oferta.precoOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            : null;

        console.log(`✅ ${oferta.titulo} — R$ ${precoFmt}`);

        await baixarImagem(oferta.thumbnail, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        // Monta mensagem
        let msg = `🔥 <b>OFERTA DO DIA!</b>\n\n`;
        msg += `<b>${oferta.titulo}</b>\n\n`;

        if (precoOrigFmt && oferta.desconto > 0) {
            msg += `<s>R$ ${precoOrigFmt}</s>\n`;
            msg += `💰 <b>R$ ${precoFmt}</b> (${oferta.desconto}% OFF)\n\n`;
        } else {
            msg += `💰 <b>R$ ${precoFmt}</b>\n\n`;
        }

        msg += `🛒 <a href="${oferta.link}">Compre aqui</a>`;

        // Adiciona cupom no final se existir
        if (cupom) {
            msg += `\n\n🎟️ <b>CUPOM:</b> <code>${cupom.codigo}</code>`;
            if (cupom.descricao) msg += `\n📌 ${cupom.descricao}`;
        }

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
