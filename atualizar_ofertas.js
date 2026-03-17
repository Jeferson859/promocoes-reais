const fs = require('fs');

async function buscarOfertas() {
    const token = process.env.LOMADEE_TOKEN;
    const sourceId = '6ff2699e-ceaa-4fad-a58a-8b91f885485f'; // Seu ID da Lomadee
    
    // URL que busca os produtos mais vendidos (Bestsellers)
    const url = `https://api.lomadee.com/v3/${token}/offer/_bestsellers?sourceId=${sourceId}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.offers && data.offers.length > 0) {
            const ofertas = data.offers.map(o => ({
                id: o.id,
                titulo: o.name,
                preco: o.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                link: o.link,
                img: o.thumbnail
            }));
            
            fs.writeFileSync('ofertas.json', JSON.stringify(ofertas, null, 2));
            console.log('✅ Ofertas atualizadas com sucesso!');
        } else {
            console.log('⚠️ Nenhuma oferta encontrada ou API ainda em análise.');
        }
    } catch (error) {
        console.error('❌ Erro ao buscar ofertas:', error);
    }
}

buscarOfertas();
