const fs = require('fs');

async function buscarVolumeMaximo() {
    const token = process.env.LOMADEE_TOKEN;
    const sourceId = '6ff2699e-ceaa-4fad-a58a-8b91f885485f'; // Seu ID de canal
    
    // Categorias focadas em Hardware e Tecnologia para volume
    const buscas = ['placa de video', 'processador', 'monitor gamer', 'teclado mecanico', 'ssd'];
    let todasOfertas = [];

    console.log("Iniciando varredura de ofertas...");

    for (const termo of buscas) {
        // Busca 12 produtos de cada categoria para ter bastante opção
        const url = `https://api.lomadee.com/v3/${token}/offer/_search?sourceId=${sourceId}&keyword=${encodeURIComponent(termo)}&size=12`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.offers && data.offers.length > 0) {
                console.log(`✅ Achei ${data.offers.length} produtos de: ${termo}`);
                todasOfertas.push(...data.offers);
            }
        } catch (e) {
            console.log(`❌ Erro ao buscar ${termo}: API ainda em análise ou fora do ar.`);
        }
    }

    if (todasOfertas.length > 0) {
        // Organiza os dados e embaralha (shuffle) para não postar sempre a mesma coisa
        const final = todasOfertas.map(o => ({
            id: o.id,
            titulo: o.name,
            preco: o.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            link: o.link,
            img: o.thumbnail
        })).sort(() => Math.random() - 0.5);

        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`🔥 Total de ${final.length} ofertas salvas no banco de dados!`);
    } else {
        console.log("⚠️ Nenhuma oferta encontrada. Provavelmente o Token ainda não foi liberado pela Lomadee.");
    }
}

buscarVolumeMaximo();
