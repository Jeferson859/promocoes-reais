const fs = require('fs');

async function buscarOfertas() {
    const TOKEN = process.env.LOMADEE_TOKEN;
    const SOURCE_ID = '6ff2699e-ceaa-4fad-a58a-8b91f885485f';
    
    // IDs das lojas: 5790 (Magalu), 5632 (Casas Bahia), 213 (Netshoes)
    const lojas = ['5790', '5632', '213'];
    let todasOfertas = [];

    for (const loja of lojas) {
        const url = `https://api.lomadee.com/v3/${TOKEN}/offer/_store/${loja}?sourceId=${SOURCE_ID}&format=json&size=10`;
        
        try {
            console.log(`Buscando loja ${loja}...`);
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.offers && data.offers.length > 0) {
                const formatadas = data.offers.map(o => ({
                    id: o.id,
                    titulo: o.name,
                    preco: o.price.toLocaleString('pt-BR'),
                    antigo: o.oldPrice ? o.oldPrice.toLocaleString('pt-BR') : o.price.toLocaleString('pt-BR'),
                    categoria: o.category.name || "Oferta",
                    img: o.thumbnail,
                    link: o.link
                }));
                todasOfertas = [...todasOfertas, ...formatadas];
            }
        } catch (e) {
            console.error(`Erro na loja ${loja}:`, e);
        }
    }

    if (todasOfertas.length === 0) {
        todasOfertas = [{
            id: 0,
            titulo: "Buscando novas ofertas do dia...",
            preco: "---",
            antigo: "---",
            categoria: "Aguarde",
            img: "https://via.placeholder.com/200",
            link: "#"
        }];
    }

    fs.writeFileSync('ofertas.json', JSON.stringify(todasOfertas, null, 2));
    console.log(`Total de ofertas salvas: ${todasOfertas.length}`);
}

buscarOfertas();
