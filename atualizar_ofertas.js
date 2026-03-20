const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

async function iniciar() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    const token = process.env.TOKEN;
    const chatId = process.env.CHAT_ID;

    try {
        // 1. Busca o produto (iPhone ou similar)
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=iphone&limit=1`);
        const data = await res.json();
        const p = data.results[0];

        const titulo = p.title;
        const preco = p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const link = `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`;
        const imgUrl = p.thumbnail.replace("-I.jpg", "-J.jpg");

        // 2. Baixa a imagem para o computador do GitHub
        const file = fs.createWriteStream("foto.jpg");
        https.get(imgUrl, function(response) {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                
                // 3. Envia para o Telegram usando cURL (Igual aos profissionais)
                const msg = `<b>${titulo}</b>\n\n💰 <b>R$ ${preco}</b>\n\n🛒 <b>Compre aqui:</b>\n${link}`;
                
                const comando = `curl -s -X POST "https://api.telegram.org/bot${token}/sendPhoto" \
                    -F chat_id="${chatId}" \
                    -F photo="@foto.jpg" \
                    -F caption="${msg}" \
                    -F parse_mode="HTML"`;
                
                execSync(comando);
                console.log("✅ Postado com sucesso!");
            });
        });

    } catch (e) {
        console.log("Erro: " + e.message);
    }
}

iniciar();
