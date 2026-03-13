const fs = require('fs');

async function buscarOfertas() {
    const TOKEN = process.env.LOMADEE_TOKEN;
    const SOURCE_ID = '38870125'; // Verifique se este ID está correto no seu painel Lomadee
    const url = `https://api.lomadee.com/v3/${TOKEN}/offer/_store/5790?sourceId=${SOURCE_ID}&format=json&size=20`;
    
    try {
        console.log("Conectando à API...");
        const response = await fetch(url);
        const data = await response.json();
        
        let ofertas = [];

        if (data.offers && data.offers.length > 0) {
            ofertas = data.offers.map(o => ({
                id: o.id,
                titulo: o.name,
                preco: o.price.toLocaleString('pt-BR'),
                antigo: o.oldPrice ? o.oldPrice.toLocaleString('pt-BR') : o.price.toLocaleString('pt-BR'),
                categoria: "Magalu",
                img: o.thumbnail,
                link: o.link
            }));
            console.log(`Sucesso: ${ofertas.length} ofertas encontradas.`);
        } else {
            console.log("API não retornou ofertas agora. Criando arquivo vazio de segurança.");
            // Criamos um item de exemplo para o arquivo não dar erro no Git
            ofertas = [{
                id: 0,
                titulo: "Buscando novas ofertas Magalu...",
                preco: "---",
                antigo: "---",
                categoria: "Aguarde",
                img: "https://via.placeholder.com/200",
                link: "#"
            }];
        }

        fs.writeFileSync('ofertas.json', JSON.stringify(ofertas, null, 2));
    } catch (e) {
        console.error('Erro na conexão:', e);
        // Cria arquivo básico para não quebrar o robô
        fs.writeFileSync('ofertas.json', JSON.stringify([], null, 2));
    }
}

buscarOfertas();
