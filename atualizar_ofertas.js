const fs = require('fs');

async function buscarOfertasMistas() {
    const lomadeeToken = process.env.LOMADEE_TOKEN;
    const sourceId = '6ff2699e-ceaa-4fad-a58a-8b91f885485f';
    const meliClientId = process.env.MELI_CLIENT_ID;
    const meliClientSecret = process.env.MELI_CLIENT_SECRET;
    
    let todasOfertas = [];

    // --- BUSCA NA LOMADEE ---
    const termosLomadee = ['placa de video', 'processador', 'ssd'];
    for (const termo of termosLomadee) {
        try {
            const res = await fetch(`https://api.lomadee.com/v3/${lomadeeToken}/offer/_search?sourceId=${sourceId}&keyword=${encodeURIComponent(termo)}&size=10`);
            const data = await res.json();
            if (data.offers) {
                data.offers.forEach(o => {
                    todasOfertas.push({
                        titulo: `🔵 ${o.name}`,
                        preco: o.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                        link: o.link,
                        img: o.thumbnail
                    });
                });
            }
        } catch (e) { console.log("Lomadee em análise..."); }
    }

    // --- BUSCA NO MERCADO LIVRE ---
    try {
        // 1. Busca produtos em oferta/relevantes
        const resML = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=hardware&sort=relevance&limit=15`);
        const dataML = await resML.json();
        
        if (dataML.results) {
            for (const prod of dataML.results) {
                // Aqui o link ainda é o comum. O Mercado Livre geralmente requer 
                // que você use o painel deles para gerar o link final de afiliado 
                // ou use a ferramenta de "Link Shortener" da API deles.
                
                todasOfertas.push({
                    titulo: `🟡 [ML] ${prod.title}`,
                    preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    link: prod.permalink, // Link do produto
                    img: prod.thumbnail.replace("-I.jpg", "-O.jpg")
                });
            }
        }
    } catch (e) { console.log("Erro no Mercado Livre."); }

    if (todasOfertas.length > 0) {
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`🚀 Sucesso! ${final.length} ofertas prontas.`);
    }
}

buscarOfertasMistas();
