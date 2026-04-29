const https = require('https');

const token = process.env.BOT_TOKEN || 'SEU_TOKEN_AQUI';

let offset = 0;

// Categorias focadas em fitness no ML
// MLB2438 = Suplementos, MLB55255 = Roupas Esportivas, MLB35235 = Musculação, MLB12711 = Esportes Geral, MLB15250 = Tênis Esportivos
const CATEGORIAS_FITNESS_ML = ['MLB2438', 'MLB55255', 'MLB35235', 'MLB12711', 'MLB15250'];

function enc(q) { return encodeURIComponent(q); }

function fetchComTimeout(url, opcoes = {}, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opcoes, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function baixarImagem(url, destino) {
    const res = await fetchComTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) {
        throw new Error(`O download da imagem falhou com status ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
        throw new Error('A imagem baixada está vazia (0 bytes)');
    }
    fs.writeFileSync(destino, buffer);
}

async function renovarTokenML() {
    const res = await fetchComTimeout('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${process.env.MELI_CLIENT_ID}&client_secret=${process.env.MELI_CLIENT_SECRET}&refresh_token=${process.env.ML_REFRESH}`
    });
  }).on('error', (e) => {
    console.error('Erro na requisição getUpdates:', e.message);
    setTimeout(getUpdates, 5000);
  });
}

function sendMessage(chatId, text) {
  const postData = JSON.stringify({
    chat_id: chatId,
    text: text
  });

    // Usa a API de Produtos do Catálogo, que permite acesso e retorna itens premium!
    const resBusca  = await fetchComTimeout(`https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(termo)}`, { headers });
    
    if (!resBusca.ok) {
        throw new Error(`Falha ao buscar produtos da busca (${resBusca.status})`);
    }
  };

    const resProd = await fetchComTimeout(`https://api.mercadolibre.com/products/${catId}`, { headers });
    if (!resProd.ok) throw new Error(`Product ${catId} falhou`);
    const prod = await resProd.json();

    const resItems = await fetchComTimeout(`https://api.mercadolibre.com/products/${catId}/items`, { headers });
    let preco = null, precoOriginal = null;
    let permalink = `https://www.mercadolivre.com.br/p/${catId}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;

  req.write(postData);
  req.end();
}

function sendPhoto(chatId) {
  const photoUrl = 'https://picsum.photos/400/300';
  const captionPart1 = 'Foto aleatória para o chat ';
  const chatIdStr = chatId.toString();
  const captionPart2 = '. Gerada em: ';
  const dataStr = new Date().toLocaleString('pt-BR');
  const caption = captionPart1 + chatIdStr + captionPart2 + dataStr; // Concatenação de strings para caption

  const postData = JSON.stringify({
    chat_id: chatId,
    photo: photoUrl,
    caption: caption,
    parse_mode: 'HTML'
  });

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${token}/sendPhoto`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      console.log(`Foto enviada para ${chatId}`);
    });
  });

  req.on('error', (e) => {
    console.error(`Erro ao enviar foto: ${e.message}`);
  });

        let resultado;

        if (oferta.loja === 'Mercado Livre') {
            const mlToken = await renovarTokenML();
            resultado = await buscarOfertaML(mlToken, oferta.produto);
        } else {
            const link      = oferta.link(oferta.produto);
            const thumbnail = oferta.imagem_fixa; // Usamos a imagem direta do produto
            
            resultado = {
                titulo: oferta.produto.toUpperCase(),
                preco: null,
                precoOriginal: null,
                desconto: null,
                link,
                thumbnail
            };
        }

        console.log(`🔗 Link: ${resultado.link}`);

        await baixarImagem(resultado.thumbnail, 'foto.jpg');
        console.log('📸 Imagem baixada!');

        let msg = `${oferta.emoji} <b>${oferta.loja.toUpperCase()}</b>\n`;
        msg += `━━━━━━━━━━━━━━━\n`;
        msg += `🔥 <b>OFERTA DO DIA!</b>\n\n`;
        msg += `<b>${resultado.titulo}</b>\n\n`;

        if (resultado.preco) {
            const precoFmt = resultado.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            if (resultado.precoOriginal && resultado.desconto > 0) {
                const origFmt = resultado.precoOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                msg += `<s>R$ ${origFmt}</s>\n`;
                msg += `💰 <b>R$ ${precoFmt}</b> (${resultado.desconto}% OFF)\n\n`;
            } else {
                msg += `💰 <b>R$ ${precoFmt}</b>\n\n`;
            }
        } else {
            msg += `💰 <b>Clique e veja o melhor preço!</b>\n\n`;
        }

        msg += `🛒 <a href="${resultado.link}">Compre aqui</a>`;

        fs.writeFileSync('msg.txt', msg);

        const cmd = `curl -s --max-time 30 -X POST "https://api.telegram.org/bot${token}/sendPhoto" \
            -F chat_id="${chatId}" \
            -F photo="@foto.jpg" \
            -F caption="<msg.txt" \
            -F parse_mode="HTML"`;

        const res  = execSync(cmd, { timeout: 35000 }).toString();
        const json = JSON.parse(res);

        if (json.ok) {
            console.log('✅ Postado com sucesso!');
        } else {
            throw new Error('Telegram recusou: ' + JSON.stringify(json));
        }

    } catch (e) {
        console.error('❌ Erro: ' + e.message);
        
        // Tenta enviar o erro para o Telegram para facilitar o diagnóstico
        try {
            const t = process.env.TELEGRAM_TOKEN;
            const c = process.env.TELEGRAM_CHAT_ID;
            if (t && c) {
                const msgErro = `⚠️ <b>O Bot encontrou um erro:</b>\n\n${e.message}\n\n<i>Se o erro for sobre o Token do ML, será necessário gerar um novo refresh_token.</i>`;
                execSync(`curl -s --max-time 15 -X POST "https://api.telegram.org/bot${t}/sendMessage" -F chat_id="${c}" -F text="${msgErro}" -F parse_mode="HTML"`, { timeout: 20000 });
            }
        } catch(err2) {}

        process.exit(1);
    }
}

console.log('Bot Telegram iniciado. Defina BOT_TOKEN no ambiente.');
getUpdates();
