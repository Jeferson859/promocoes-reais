const fs = require('fs');

async function buscarProdutosReais() {
    const meliAffiliateId = 'daje8667974'; 
    const meliAppId = '7346131242004348';  
    let todasOfertas = [];

    // Termos que vendem muito
    const buscas = ['iphone 15', 'placa de video', 'monitor gamer', 'ssd nvme'];

    console.log("🔍 Buscando produtos para PROMOREAIS...");

    for (const termo of buscas) {
        try {
            const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&sort=relevance&limit=10`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                data.results.forEach(prod => {
                    todasOfertas.push({
                        titulo: prod.title,
                        preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                        // LINK COM SEU ID DE AFILIADO
                        link: `${prod.permalink}?matt_tool=${meliAppId}&utm_campaign=${meliAffiliateId}`,
                        img: prod.thumbnail.replace("-I.jpg", "-O.jpg").trim()
                    });
                });
            }
        } catch (e) { console.log("Erro na busca"); }
    }

    if (todasOfertas.length > 0) {
        // Embaralha para o canal ter sempre novidade
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`✅ Sucesso! ${final.length} produtos carregados.`);
    }
}

buscarProdutosReais();
