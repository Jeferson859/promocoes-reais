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

async function iniciar() {
    const meliId = 'daje8667974';
    const appId  = '7346131242004348';
    const token  = process.env.TOKEN;
    const chatId = process.env.CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ TOKEN ou CHAT_ID não definidos nos secrets!');
        process.exit(1);
    }

    try {
        // 1. Busca produto — com User-Agent para evitar bloqueio
        console.log('🔍 Buscando produto...');
        const res = await fetch('https://api.mercadolibre.com/sites/MLB/search?q=iphone&limit=5', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)',
                'Accept': 'application/json'
            }
        });

        console.log(`📡 Status da API: ${res.status}`);
        const data = await res.json();
        console.log(`📦 Total encontrado: ${data.results ? data.results.length : 0}`);

        // Debug: mostra resposta se vier vazia
        if (!data.results || data.results.length === 0) {
            console.log('⚠️ Resposta da API:', JSON.stringify(data).slice(0, 500));
            throw new Error('Nenhum produto encontrado.');
        }

        const p      = data.results[0];
        const titulo = p.title;
        const preco  = p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const link   = `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`;
        const imgUrl = p.thumbnail.replace('-I.jpg', '-J.jpg');

        console.log(`✅ Produto: ${titulo} — R$ ${preco}`);

        // 2. Baixa imagem
        await baixarImagem(imgUrl, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        // 3. Monta mensagem
        const msg = `🔥 <b>OFERTA DO DIA!</b>\n\n<b>${titulo}</b>\n\n💰 <b>R$ ${preco}</b>\n\n🛒 <b>Compre aqui:</b>\n${link}`;
        fs.writeFileSync('msg.txt', msg);

        // 4. Envia para o Telegram
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
