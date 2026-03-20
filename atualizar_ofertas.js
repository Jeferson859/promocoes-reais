const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

function baixarImagem(url, destino) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destino);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', reject);
        }).on('error', reject);
    });
}

async function renovarToken() {
    const clientId     = process.env.MELI_CLIENT_ID;
    const clientSecret = process.env.MELI_CLIENT_SECRET;
    const refreshToken = process.env.ML_REFRESH;

    console.log('🔄 Renovando token...');
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`
    });

    const data = await res.json();
    if (!data.access_token) {
        throw new Error('Falha ao renovar token: ' + JSON.stringify(data));
    }
    console.log('✅ Token renovado!');
    return data.access_token;
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
        // 1. Renova o token do ML automaticamente
        const mlToken = await renovarToken();

        // 2. Busca produto com token autenticado
        console.log('🔍 Buscando produto...');
        const res = await fetch('https://api.mercadolibre.com/sites/MLB/search?q=iphone&limit=5&sort=relevance', {
            headers: { 'Authorization': `Bearer ${mlToken}` }
        });

        console.log(`📡 Status da API: ${res.status}`);
        const data = await res.json();
        console.log(`📦 Total encontrado: ${data.results ? data.results.length : 0}`);

        if (!data.results || data.results.length === 0) {
            console.log('⚠️ Resposta:', JSON.stringify(data).slice(0, 300));
            throw new Error('Nenhum produto encontrado.');
        }

        // 3. Pega produto com maior desconto
        const p = data.results.reduce((melhor, atual) => {
            const dAtual  = atual.original_price ? (atual.original_price - atual.price) / atual.original_price : 0;
            const dMelhor = melhor.original_price ? (melhor.original_price - melhor.price) / melhor.original_price : 0;
            return dAtual > dMelhor ? atual : melhor;
        });

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

        // 4. Baixa imagem
        await baixarImagem(imgUrl, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        // 5. Monta mensagem
        let msg = `🔥 <b>OFERTA DO DIA!</b>\n\n<b>${titulo}</b>\n\n`;
        if (precoOriginal && desconto > 0) {
            msg += `<s>R$ ${precoOriginal}</s>\n`;
            msg += `💰 <b>R$ ${preco}</b> (${desconto}% OFF)\n\n`;
        } else {
            msg += `💰 <b>R$ ${preco}</b>\n\n`;
        }
        msg += `🛒 <b>Compre aqui:</b>\n${link}`;

        fs.writeFileSync('msg.txt', msg);

        // 6. Envia para o Telegram
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
