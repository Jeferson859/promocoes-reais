const fs = require('fs');

async function buscar() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    
    console.log("🔍 Buscando iPhone 15...");

    try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=iphone%2015&limit=1`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const p = data.results[0];
            const oferta = {
                titulo: p.title,
                preco: p.price.toLocaleString('pt-BR'),
                link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
                img: p.thumbnail.replace("-I.jpg", "-O.jpg").trim()
            };
            fs.writeFileSync('temp_oferta.json', JSON.stringify(oferta));
            console.log("✅ Oferta real encontrada!");
        } else {
            throw new Error("Busca vazia");
        }
    } catch (e) {
        console.log("⚠️ Falha na busca, gerando oferta de segurança...");
        // OFERTA DE SEGURANÇA (Para garantir que CHEGUE no seu Telegram agora)
        const reserva = {
            titulo: "Confira as Ofertas do Dia PROMOREAIS",
            preco: "Ver no Site",
            link: `https://www.mercadolivre.com.br?matt_tool=${appId}&utm_campaign=${meliId}`,
            img: "https://http2.mlstatic.com/static/org-img/homesnack/home/logo_off_30_v2.png"
        };
        fs.writeFileSync('temp_oferta.json', JSON.stringify(reserva));
    }
}
buscar();
