const fs = require('fs');

async function buscarProdutos() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    let lista = [];

    // Buscas variadas para ter volume
    const termos = ['iphone', 'ssd', 'monitor', 'placa de video'];

    for (const t of termos) {
        try {
            const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(t)}&limit=5`);
            const data = await res.json();
            
            data.results.forEach(p => {
                lista.push({
                    titulo: p.title,
                    preco: p.price.toLocaleString('pt-BR'),
                    link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
                    // Força uma imagem limpa e segura
                    img: p.thumbnail.replace("-I.jpg", "-O.jpg").trim()
                });
            });
        } catch (e) { console.log("Erro no termo: " + t); }
    }

    // Embaralha e salva
    const final = lista.sort(() => Math.random() - 0.5);
    fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
    console.log("✅ Busca finalizada com " + final.length + " produtos!");
}
buscarProdutos();
