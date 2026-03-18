const fs = require('fs');

async function buscarOfertasMistas() {
    const lomadeeToken = process.env.LOMADEE_TOKEN;
    const sourceId = '6ff2699e-ceaa-4fad-a58a-8b91f885485f';
    const meliAffiliateId = 'daje8667974'; // Seu novo ID atualizado
    const meliAppId = '7346131242004348'; // Seu Client ID do ML
    
    let todasOfertas = [];

    console.log("Iniciando busca para Promo_Reais...");

    // --- 🔵 BUSCA NA LOMADEE (Magalu, Kabum, etc) ---
    try {
        const termosLomadee = ['smartphone', 'hardware', 'informatica'];
        for (const termo of termosLomadee) {
            const res = await fetch(`https://api.lomadee.com/v3/${lomadeeToken}/offer/_search?sourceId=${sourceId}&keyword=${encodeURIComponent(termo)}&size=12`);
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
        }
    } catch (e) { 
        console.log("Lomadee: Ainda em análise ou limite atingido."); 
    }

    // --- 🟡 BUSCA NO MERCADO LIVRE (Promo_Reais) ---
    try {
        // Busca produtos relevantes e em oferta
        const resML = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=hardware&sort=relevance&limit=20`);
        const dataML = await resML.json();
        
        if (dataML.results) {
            dataML.results.forEach(prod => {
                // Monta o link de afiliado oficial para o perfil Promo_Reais
                // matt_tool = ID da sua aplicação | campaign = Seu ID de afiliado
                const linkAfiliado = `${prod.permalink}?matt_tool=${meliAppId}&utm_source=afiliado&utm_medium=telegram&utm_campaign=${meliAffiliateId}`;
                
                todasOfertas.push({
                    titulo: `🟡 [PROMO] ${prod.title}`,
                    preco: prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                    link: linkAfiliado,
                    img: prod.thumbnail.replace("-I.jpg", "-O.jpg") // Foto de alta qualidade
                });
            });
        }
    } catch (e) { 
        console.log("Erro ao conectar com a API do Mercado Livre."); 
    }

    // --- FINALIZAÇÃO ---
    if (todasOfertas.length > 0) {
        // Embaralha as ofertas para o canal ter sempre novidade
        const final = todasOfertas.sort(() => Math.random() - 0.5);
        
        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`🔥 Sucesso! ${final.length} ofertas prontas para o canal Promo_Reais.`);
    } else {
        console.log("⚠️ Nenhuma oferta encontrada. Verifique os Tokens.");
    }
}

buscarOfertasMistas();
