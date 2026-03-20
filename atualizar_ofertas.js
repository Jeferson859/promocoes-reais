const fs = require('fs');

async function buscar() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    
    try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=iphone&limit=5`);
        const data = await res.json();
        const ofertas = data.results.map(p => ({
            titulo: p.title,
            preco: p.price.toLocaleString('pt-BR'),
            link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
            img: p.thumbnail.replace("-I.jpg", "-O.jpg")
        }));
        fs.writeFileSync('ofertas.json', JSON.stringify(ofertas, null, 2));
        console.log("Busca concluída!");
    } catch (e) { console.log("Erro na busca"); }
}
buscar();
