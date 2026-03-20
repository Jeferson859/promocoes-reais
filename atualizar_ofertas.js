const fs = require('fs');

async function buscarEPreparar() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    
    try {
        // Busca o iPhone 15 que é venda certa
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=iphone%2015&limit=1`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            const p = data.results[0];
            const oferta = {
                titulo: p.title,
                preco: p.price.toLocaleString('pt-BR'),
                link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
                img: p.thumbnail.replace("-I.jpg", "-O.jpg")
            };
            // Salva apenas 1 oferta temporária
            fs.writeFileSync('temp_oferta.json', JSON.stringify(oferta));
            console.log("✅ Oferta preparada!");
        }
    } catch (e) {
        console.log("Erro na busca");
    }
}
buscarEPreparar();
