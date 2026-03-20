const fs = require('fs');

async function buscar() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    
    try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=iphone&limit=1`);
        const data = await res.json();
        const p = data.results[0];

        const oferta = {
            titulo: p.title,
            preco: p.price.toLocaleString('pt-BR'),
            link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
            img: p.thumbnail.replace("-I.jpg", "-O.jpg")
        };

        fs.writeFileSync('temp_oferta.json', JSON.stringify(oferta));
        console.log("✅ Oferta salva!");
    } catch (e) {
        // Se a busca falhar, cria uma oferta manual para não dar erro no GitHub
        const manual = {
            titulo: "Confira as Ofertas do Dia no Mercado Livre",
            preco: "Ver no Site",
            link: `https://www.mercadolivre.com.br?matt_tool=${appId}&utm_campaign=${meliId}`,
            img: "https://http2.mlstatic.com/static/org-img/homesnack/home/logo_off_30_v2.png"
        };
        fs.writeFileSync('temp_oferta.json', JSON.stringify(manual));
    }
}
buscar();
