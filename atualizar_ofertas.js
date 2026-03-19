const fs = require('fs');

async function buscarProdutosMeli() {
    const meliAffiliateId = 'daje8667974'; 
    const meliAppId = '7346131242004348';  
    let todasOfertas = [];

    // Termos que sempre trazem bons resultados no Mercado Livre
    const termos = ['iphone', 'ssd kingston', 'placa de video rtx', 'monitor gamer'];

    console.log("🔍 Iniciando busca de produtos reais...");

    for (const item of termos) {
        try {
            const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(item)}&limit=10`);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                data.results.forEach(prod => {
                    todasOfertas.push({
                        titulo: prod.title,
                        preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                        // Link com seus IDs de Afiliado PROMOREAIS
                        link: `${prod.permalink}?matt_tool=${meliAppId}&utm_campaign=${meliAffiliateId}`,
                        img: prod.thumbnail.replace("-I.jpg", "-O.jpg").trim() // Imagem de alta qualidade
                    });
                });
            }
        } catch (e) {
            console.log("Erro na busca do termo: " + item);
        }
    }

    // Se a busca falhar, não deixa o arquivo vazio (evita erro de undefined)
    if (todasOfertas.length === 0) {
        todasOfertas.push({
            titulo: "Confira as Ofertas do Dia",
            preco: "Ver no Site",
            link: `https://www.mercadolibre.com.br?matt_tool=${meliAppId}&utm_campaign=${meliAffiliateId}`,
            img: "https://http2.mlstatic.com/static/org-img/homesnack/home/logo_off_30_v2.png"
        });
    }

    // Embaralha para o canal ter sempre novidade
    const resultadoFinal = todasOfertas.sort(() => Math.random() - 0.5);
    fs.writeFileSync('ofertas.json', JSON.stringify(resultadoFinal, null, 2));
    console.log(`✅ ${resultadoFinal.length} ofertas salvas com sucesso!`);
}

buscarProdutosMeli();
