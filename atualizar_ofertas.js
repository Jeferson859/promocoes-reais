const fs = require('fs');

async function buscarOfertasMistas() {
    const lomadeeToken = process.env.LOMADEE_TOKEN;
    const sourceId = '6ff2699e-ceaa-4fad-a58a-8b91f885485f';
    
    let todasOfertas = [];

    // --- BUSCA NA LOMADEE (Hardware) ---
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
        } catch (e) { console.log("Lomadee: Aguardando aprovação..."); }
    }

    // --- BUSCA NO MERCADO LIVRE (Ofertas Relâmpago) ---
    // Aqui buscamos produtos com desconto direto na API do ML
    try {
        const resML = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=hardware&sort=relevance&limit=15`);
        const dataML = await resML.json();
        
        if (dataML.results) {
            dataML.results.forEach(prod => {
                todasOfertas.push({
                    titulo: `🟡 [MERCADO LIVRE] ${prod.title}`,
                    preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    link: prod.permalink, // Depois vamos converter para link de afiliado
                    img: prod.thumbnail.replace("-I.jpg", "-O.jpg") // Melhora a qualidade da imagem
                });
            });
        }
    } catch (e) { console.log("Erro ao buscar no Mercado Livre."); }

    if (todasOfertas.length > 0) {
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`🚀 Sucesso! ${final.length} ofertas prontas para disparar.`);
    }
}

buscarOfertasMistas();
