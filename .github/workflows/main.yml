const fs = require('fs');

async function buscarOfertasMeli() {
    const meliAffiliateId = 'daje8667974'; // Seu ID do perfil
    const meliAppId = '7346131242004348';  // Seu Client ID
    
    let todasOfertas = [];

    // Categorias de busca para dar volume ao canal
    const buscas = ['smartphone', 'placa de video', 'monitor gamer', 'ssd'];

    console.log("🔍 Iniciando busca pública no Mercado Livre...");

    for (const termo of buscas) {
        try {
            // Busca pública (não precisa de token de acesso)
            const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(termo)}&sort=relevance&limit=10`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.results && data.results.length > 0) {
                data.results.forEach(prod => {
                    // Montagem do link de afiliado com base no seu perfil PROMOREAIS
                    const linkAfiliado = `${prod.permalink}?matt_tool=${meliAppId}&utm_source=afiliado&utm_medium=telegram&utm_campaign=${meliAffiliateId}`;
                    
                    todasOfertas.push({
                        id: prod.id,
                        titulo: prod.title,
                        preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                        link: linkAfiliado,
                        img: prod.thumbnail.replace("-I.jpg", "-O.jpg") // Imagem maior
                    });
                });
            }
        } catch (e) {
            console.log(`❌ Erro ao buscar ${termo}:`, e.message);
        }
    }

    if (todasOfertas.length > 0) {
        // Embaralha para não postar sempre a mesma ordem
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`✅ Sucesso! ${final.length} ofertas salvas no ofertas.json`);
    } else {
        console.log("⚠️ Nenhuma oferta encontrada na busca pública.");
        // Cria um arquivo vazio mas válido para não dar erro no main.yml
        fs.writeFileSync('ofertas.json', JSON.stringify([]));
    }
}

buscarOfertasMeli();
