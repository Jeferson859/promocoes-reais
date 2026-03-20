const fs = require('fs');

async function buscarProdutos() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    
    // Lista de desejos que vendem muito
    const buscas = ['iphone', 'geladeira', 'smart tv 50', 'notebook'];
    // Sorteia um termo da lista para cada postagem ser diferente
    const termo = buscas[Math.floor(Math.random() * buscas.length)];
    
    console.log(`🔍 Buscando: ${termo}...`);

    try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&limit=10&sort=relevance`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            // Pega um produto aleatório dos 10 primeiros resultados
            const p = data.results[Math.floor(Math.random() * data.results.length)];
            
            const oferta = {
                titulo: p.title.substring(0, 80), // Título não muito longo
                preco: p.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
                img: p.thumbnail.replace("-I.jpg", "-O.jpg").trim()
            };

            fs.writeFileSync('temp_oferta.json', JSON.stringify(oferta));
            console.log("✅ Produto real salvo!");
        } else {
            throw new Error("Busca vazia");
        }
    } catch (e) {
        console.log("⚠️ Usando oferta reserva...");
        const reserva = {
            titulo: "Ofertas Incríveis no Mercado Livre",
            preco: "Confira",
            link: `https://www.mercadolivre.com.br?matt_tool=${appId}&utm_campaign=${meliId}`,
            img: "https://http2.mlstatic.com/static/org-img/homesnack/home/logo_off_30_v2.png"
        };
        fs.writeFileSync('temp_oferta.json', JSON.stringify(reserva));
    }
}
buscarProdutos();
