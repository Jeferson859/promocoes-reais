const fs = require('fs');

async function buscarProdutosReais() {
    const meliAffiliateId = 'daje8667974'; 
    const meliAppId = '7346131242004348';  
    let todasOfertas = [];

    // Termos de busca que vendem muito no Telegram
    const buscas = ['placa de video', 'ssd 1tb', 'monitor gamer', 'iphone 15'];

    console.log("🔍 Caçando ofertas reais no Mercado Livre...");

    for (const termo of buscas) {
        try {
            // Busca os itens mais relevantes e em oferta
            const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&sort=relevance&limit=15`);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                data.results.forEach(prod => {
                    // Monta o link com sua comissão
                    const linkAfiliado = `${prod.permalink}?matt_tool=${meliAppId}&utm_source=afiliado&utm_medium=telegram&utm_campaign=${meliAffiliateId}`;
                    
                    todasOfertas.push({
                        titulo: prod.title,
                        preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                        link: linkAfiliado,
                        img: prod.thumbnail.replace("-I.jpg", "-O.jpg") // Imagem grande
                    });
                });
            }
        } catch (e) {
            console.log(`Erro ao buscar ${termo}`);
        }
    }

    // Se achou produtos, salva eles. Se não achou, mantém o arquivo pronto.
    if (todasOfertas.length > 0) {
        // Embaralha para o canal não ficar repetitivo
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`✅ Sucesso! ${final.length} ofertas reais carregadas.`);
    }
}

buscarProdutosReais();
