const fs = require('fs');

async function buscarOfertasMeli() {
    const meliAffiliateId = 'daje8667974'; //
    const meliAppId = '7346131242004348';  //
    let todasOfertas = [];

    try {
        const res = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=hardware&limit=10`);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            data.results.forEach(prod => {
                todasOfertas.push({
                    titulo: prod.title,
                    preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    link: `${prod.permalink}?matt_tool=${meliAppId}&utm_campaign=${meliAffiliateId}`,
                    img: prod.thumbnail.replace("-I.jpg", "-O.jpg").trim()
                });
            });
        }
    } catch (e) { console.log("Erro na busca."); }

    // Se falhar, gera uma oferta real do ML manualmente para testar o canal
    if (todasOfertas.length === 0) {
        todasOfertas.push({
            titulo: "🔥 Oferta do Dia no Mercado Livre",
            preco: "Ver no Site",
            link: `https://www.mercadolivre.com.br?matt_tool=${meliAppId}&utm_campaign=${meliAffiliateId}`,
            img: "https://http2.mlstatic.com/static/org-img/homesnack/home/logo_off_30_v2.png"
        });
    }

    fs.writeFileSync('ofertas.json', JSON.stringify(todasOfertas, null, 2));
}
buscarOfertasMeli();
