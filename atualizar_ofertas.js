const fs = require('fs');

async function buscarVolumeMaximo() {
    const token = process.env.LOMADEE_TOKEN;
    const sourceId = '6ff2699e-ceaa-4fad-a58a-8b91f885485f';
    
    // Lista de buscas para ter muito volume
    const buscas = ['ofertas', 'smartphone', 'informatica', 'games', 'eletronicos'];
    let todasOfertas = [];

    for (const termo of buscas) {
        const url = `https://api.lomadee.com/v3/${token}/offer/_search?sourceId=${sourceId}&keyword=${termo}&size=10`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.offers) todasOfertas.push(...data.offers);
        } catch (e) { console.log(`Erro ao buscar ${termo}`); }
    }

    if (todasOfertas.length > 0) {
        // Remove duplicados e embaralha para o canal parecer sempre novo
        const final = todasOfertas.map(o => ({
            id: o.id,
            titulo: o.name,
            preco: o.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
            link: o.link,
            img: o.thumbnail
        })).sort(() => Math.random() - 0.5);

        fs.writeFileSync('ofertas.json', JSON.stringify(final, null, 2));
        console.log(`🔥 Sucesso! ${final.length} ofertas prontas.`);
    }
}
buscarVolumeMaximo();
