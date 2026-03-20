const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

// Função para baixar a imagem com suporte a redirecionamento
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
    try {
        const res = await fetch('https://api.mercadolibre.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=refresh_token&client_id=${process.env.MELI_CLIENT_ID}&client_secret=${process.env.MELI_CLIENT_SECRET}&refresh_token=${process.env.ML_REFRESH}`
        });
        const data = await res.json();
        if (!data.access_token) throw new Error('Token falhou');
        return data.access_token;
    } catch (e) {
        console.log("⚠️ Erro no Token, usando busca pública...");
        return null;
    }
}

async function buscarProduto(mlToken) {
    // Tenta busca por API oficial, se falhar, usa busca pública (mais seguro)
    const buscaRes = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=smartphone&limit=5`);
    const data = await buscaRes.json();
    const p = data.results[Math.floor(Math.random() * data.results.length)];

    return {
        title: p.title,
        price: p.price,
        original_price: p.original_price,
        thumbnail: p.thumbnail.replace('-I.jpg', '-O.jpg'),
        permalink: p.permalink.split('?')[0] // LIMPA O LINK PARA NÃO DAR UNDEFINED
    };
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const meliId = 'daje8667974';
    const appId  = '7346131242004348';

    try {
        const mlToken = await renovarToken();
        const p = await buscarProduto(mlToken);

        const preco = p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const link = `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`;
        
        await baixarImagem(p.thumbnail, 'foto.jpg');

        let msg = `🔥 <b>OFERTA DO DIA!</b>\n\n<b>${p.title}</b>\n\n`;
        msg += `💰 <b>R$ ${preco}</b>\n\n`;
        msg += `🛒 <b>Compre aqui:</b>\n${link}`;

        fs.writeFileSync('msg.txt', msg);

        const comando = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" \
            -F chat_id="${chatId}" \
            -F photo="@foto.jpg" \
            -F caption="$(cat msg.txt)" \
            -F parse_mode="HTML"`;

        execSync(comando);
        console.log('✅ Postado com sucesso!');

    } catch (e) {
        console.error('❌ Erro: ' + e.message);
    }
}

iniciar();
