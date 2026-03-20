const fs = require('fs');

async function buscar() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    
    try {
        // Busca um iPhone para testar o visual profissional
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=iphone&limit=1`);
        const data = await res.json();
        const p = data.results[0];

        const oferta = {
            titulo: p.title,
            preco: p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
            // Pega a imagem maior disponível
            img: p.thumbnail.replace("-I.jpg", "-J.jpg") 
        };

        fs.writeFileSync('temp_oferta.json', JSON.stringify(oferta));
        console.log("✅ Produto pronto!");
    } catch (e) {
        console.log("Erro na busca");
    }
}
buscar();
