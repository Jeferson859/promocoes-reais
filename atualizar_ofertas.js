const fs = require('fs');

const TOKEN = process.env.LOMADEE_TOKEN;
const SOURCE_ID = '38870125'; // Coloquei seu ID aproximado, se tiver o exato, troque aqui.

async function buscarOfertas() {
    // Busca 20 ofertas da Magalu (ID 5790)
    const url = `https://api.lomadee.com/v3/${TOKEN}/offer/_store/5790?sourceId=${SOURCE_ID}&format=json&size=20`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.offers) {
            console.log("Nenhuma oferta encontrada.");
            return;
        }

        const ofertas = data.offers.map(o => ({
            id: o.id,
            titulo: o.name,
            preco: o.price.toLocaleString('pt-BR'),
            antigo: o.oldPrice ? o.oldPrice.toLocaleString('pt-BR') : o.price.toLocaleString('pt-BR'),
            categoria: "Magalu",
            img: o.thumbnail,
            link: o.link,
            cupom: null
        }));

        fs.writeFileSync('ofertas.json', JSON.stringify(ofertas, null, 2));
        console.log('Ofertas salvas com sucesso!');
    } catch (e) {
        console.error('Erro:', e);
    }
}
buscarOfertas();
