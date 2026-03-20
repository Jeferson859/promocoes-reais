const fs = require('fs');

async function buscarProdutos() {
    const meliId = 'daje8667974';
    const appId = '7346131242004348';
    let lista = [];

    console.log("🔍 Buscando no Mercado Livre...");

    try {
        // Busca direta e simples
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=smartphone&limit=10`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            lista = data.results.map(p => ({
                titulo: p.title,
                preco: p.price.toLocaleString('pt-BR'),
                link: `${p.permalink}?matt_tool=${appId}&utm_campaign=${meliId}`,
                img: p.thumbnail.replace("-I.jpg", "-O.jpg").trim()
            }));
            console.log(`✅ Achei ${lista.length} produtos!`);
        } else {
            console.log("⚠️ API não retornou produtos.");
        }
    } catch (e) { 
        console.log("❌ Erro na busca:", e.message); 
    }

    // Se a lista estiver vazia por erro da API, coloca um item de segurança para o robô não travar
    if (lista.length === 0) {
        lista.push({
            titulo: "Confira as Ofertas do Dia",
            preco: "Ver no Site",
            link: `https://www.mercadolivre.com.br?matt_tool=${appId}&utm_campaign=${meliId}`,
            img: "https://http2.mlstatic.com/static/org-img/homesnack/home/logo_off_30_v2.png"
        });
    }

    fs.writeFileSync('ofertas.json', JSON.stringify(lista, null, 2));
    console.log("💾 Arquivo ofertas.json salvo!");
}

buscarProdutos();
