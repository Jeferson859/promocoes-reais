const fs = require('fs');

async function buscarProdutosReais() {
    const meliAffiliateId = 'daje8667974'; 
    const meliAppId = '7346131242004348';  
    let todasOfertas = [];

    // Foco total em Hardware e Tecnologia
    const buscas = ['placa de video nvidia', 'ssd nvme', 'processador ryzen', 'monitor gamer'];

    console.log("🔍 Caçando produtos reais no Mercado Livre...");

    for (const termo of buscas) {
        try {
            const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&sort=relevance&limit=20`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                data.results.forEach(prod => {
                    // Link de Afiliado PROMOREAIS
                    const linkAfiliado = `${prod.permalink}?matt_tool=${meliAppId}&utm_source=afiliado&utm_medium=telegram&utm_campaign=${meliAffiliateId}`;
                    
                    todasOfertas.push({
                        titulo: prod.title,
                        preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                        link: linkAfiliado,
                        img: prod.thumbnail.replace("-I.jpg", "-O.jpg") // Imagem Grande
                    });
                });
            }
        } catch (e) {
            console.log(`Erro ao buscar ${termo}`);
        }
    }

    if (todasOfertas.length > 0) {
        // Embaralha para o canal não ficar repetitivo
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`✅ Sucesso! ${final.length} produtos reais salvos.`);
    }
}

buscarProdutosReais();
