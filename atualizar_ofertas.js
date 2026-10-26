const fs = require('fs');
const { execSync } = require('child_process');

const MELI_APP_ID = '7346131242004348';
const MELI_ID     = 'daje8667974';

const MAX_POR_EXECUCAO = 1; // produtos postados por rodada
const MAX_IDS_HISTORICO = 100; // IDs guardados para evitar repetição

// Só posta oferta com pelo menos este desconto (pode trocar pelo secret/env DESCONTO_MINIMO)
const DESCONTO_MINIMO = Number(process.env.DESCONTO_MINIMO || 25);
const TERMOS_POR_RODADA = 8;   // termos avaliados por execução (pega o MAIOR desconto entre eles)
const PRODUTOS_POR_TERMO = 25; // produtos avaliados por termo

const TERMOS_BUSCA = [
    // Suplementos
    'whey protein', 'whey isolado', 'creatina', 'creatina monohidratada', 'colageno hidrolisado',
    'vitamina c', 'vitamina d', 'omega 3', 'multivitaminico', 'magnesio', 'pre treino', 'cafeina capsula',
    'bcaa', 'glutamina', 'proteina vegana', 'albumina', 'hipercalorico', 'termogenico',
    'barra de proteina', 'pasta de amendoim', 'beta alanina', 'coqueteleira',
    // Roupas e calçados
    'tenis corrida', 'tenis academia', 'legging fitness', 'bermuda academia', 'camiseta dry fit',
    'top fitness', 'conjunto fitness feminino', 'regata academia', 'meia compressao', 'jaqueta corta vento',
    // Equipamentos para treinar em casa
    'halteres', 'kit halteres', 'kettlebell', 'corda pular', 'colchonete yoga', 'tapete yoga',
    'faixa elastica resistencia', 'mini band', 'barra musculacao', 'anilha academia', 'step aerobico',
    'banco supino', 'barra fixa porta', 'roda abdominal', 'hand grip', 'caneleira peso',
    'bola suica', 'rolo liberacao miofascial', 'elastico extensor', 'paralela flexao',
    // Equipamentos grandes
    'bike ergometrica', 'esteira eletrica', 'eliptico', 'estacao musculacao', 'bicicleta spinning',
    // Acessórios e tecnologia
    'smartwatch fitness', 'monitor frequencia cardiaca', 'fone bluetooth esportivo', 'garrafa termica academia',
    'bolsa academia', 'mochila academia', 'luva academia', 'cinto musculacao', 'balanca bioimpedancia',
    'joelheira esportiva', 'munhequeira', 'massageador muscular', 'squeeze academia',
    // Mais termos (26/10) para ter oferta boa em mais rodadas
    'whey concentrado', 'whey 900g', 'creatina 1kg', 'creatina gummy', 'pre treino em po', 'cafeina 420mg',
    'termogenico capsula', 'colageno verisol', 'proteina isolada', 'shake proteico', 'snack proteico',
    'pasta de amendoim integral', 'maltodextrina', 'dextrose', 'zma', 'melatonina', 'complexo b',
    'tenis caminhada feminino', 'tenis corrida masculino', 'tenis treino crossfit', 'meia esportiva kit',
    'shorts corrida', 'calca legging', 'macaquinho fitness', 'top nadador', 'regata dry fit', 'moletom academia',
    'bone esportivo', 'oculos esportivo', 'pochete corrida', 'braçadeira celular corrida',
    'halter regulavel', 'anilha emborrachada', 'barra w', 'puxador costas', 'aparelho abdominal',
    'prancha equilibrio', 'disco de equilibrio', 'tornozeleira peso', 'elastico glúteo', 'kit elasticos treino',
    'gaiola agachamento', 'rack musculacao', 'bike spinning', 'remo seco', 'mini stepper', 'trampolim jump',
    'cama elastica fitness', 'colchonete academia', 'tapete eva academia', 'bola de pilates 65cm',
    'luva crossfit', 'strap musculacao', 'joelheira levantamento', 'coqueteleira eletrica', 'garrafa 2 litros academia',
    'pistola massagem', 'relogio corrida gps', 'pulseira inteligente', 'fone conducao ossea',
];

function fetchComTimeout(url, opcoes = {}, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opcoes, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function baixarImagem(url, destino) {
    const res = await fetchComTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Download da imagem falhou com status ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) throw new Error('Imagem baixada está vazia (0 bytes)');
    fs.writeFileSync(destino, buffer);
}

async function renovarTokenML() {
    const res = await fetchComTimeout('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&client_id=${process.env.MELI_CLIENT_ID}&client_secret=${process.env.MELI_CLIENT_SECRET}&refresh_token=${process.env.ML_REFRESH}`
    });
    const data = await res.json();
    if (!data.access_token) {
        const expirado = data.error === 'invalid_grant' || (data.message || '').toLowerCase().includes('expired');
        const msg = expirado
            ? '🔑 Refresh token expirado! Acesse o ML Developer Portal e gere um novo refresh_token.'
            : 'Falha ao renovar token ML: ' + JSON.stringify(data);
        throw new Error(msg);
    }
    console.log('✅ Token ML renovado!');
    return data.access_token;
}

async function buscarPorTermo(headers, termo, ultimosIds, limite) {
    const resBusca = await fetchComTimeout(
        `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(termo)}&limit=50`,
        { headers },
        30000
    );
    if (!resBusca.ok) {
        const corpo = await resBusca.text();
        throw new Error(`Falha na busca (${resBusca.status}): ${corpo}`);
    }

    const buscaData = await resBusca.json();
    if (!buscaData.results || buscaData.results.length === 0) return [];

    const ids = buscaData.results.map(p => p.id).filter(id => !ultimosIds.includes(id)).slice(0, limite);
    const candidatos = [];

    for (const id of ids) {
        const resProd = await fetchComTimeout(`https://api.mercadolibre.com/products/${id}`, { headers }, 20000);
        if (!resProd.ok) continue;
        const prod = await resProd.json();

        const resItems = await fetchComTimeout(`https://api.mercadolibre.com/products/${id}/items`, { headers }, 20000);
        if (!resItems.ok) continue;
        const itemsData = await resItems.json();
        if (!itemsData.results?.length) continue;

        // o anúncio com MAIOR desconto entre os vendedores do produto
        const descontoDe = (i) => (i.price && i.original_price) ? (i.original_price - i.price) / i.original_price : 0;
        const item = [...itemsData.results].filter(i => i.price).sort((a, b) => descontoDe(b) - descontoDe(a))[0];
        if (!item) continue;

        const preco         = item.price;
        const precoOriginal = item.original_price || null;
        const desconto      = precoOriginal ? Math.round(descontoDe(item) * 100) : 0;
        const img           = (prod.pictures?.[0]?.url || '').replace(/-[A-Z]\.jpg$/, '-J.jpg');
        if (!img || desconto < DESCONTO_MINIMO) continue;

        console.log(`  • ${desconto}% OFF — ${prod.name} — R$ ${preco}`);
        candidatos.push({ id, itemId: item.id, titulo: prod.name, preco, precoOriginal, desconto, thumbnail: img,
                          freteGratis: !!(item.shipping && item.shipping.free_shipping) });
    }

    return candidatos;
}

// Monta o link de afiliado só para os produtos escolhidos (economiza chamadas na API)
async function linkAfiliado(headers, cand) {
    let permalink = `https://www.mercadolivre.com.br/p/${cand.id}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
    if (cand.itemId) {
        const resDetalhe = await fetchComTimeout(`https://api.mercadolibre.com/items/${cand.itemId}`, { headers }, 15000);
        if (resDetalhe.ok) {
            const detalhe = await resDetalhe.json();
            if (detalhe.permalink) permalink = `${detalhe.permalink}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
        }
    }
    return permalink;
}

async function buscarOfertas(mlToken, ultimosIds) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const slot    = Math.floor(Date.now() / (15 * 60 * 1000));
    const candidatos = [];

    // avalia alguns termos por rodada, girando a lista, e fica com os MAIORES descontos
    for (let i = 0; i < TERMOS_POR_RODADA; i++) {
        const termo = TERMOS_BUSCA[(slot * TERMOS_POR_RODADA + i) % TERMOS_BUSCA.length];
        console.log(`🔎 Buscando: "${termo}" (mínimo ${DESCONTO_MINIMO}% OFF)`);
        try {
            const vistos = [...ultimosIds, ...candidatos.map(p => p.id)];
            const encontrados = await buscarPorTermo(headers, termo, vistos, PRODUTOS_POR_TERMO);
            candidatos.push(...encontrados);
            if (encontrados.length === 0) console.log(`⚠️ Nada com ${DESCONTO_MINIMO}%+ em "${termo}"`);
        } catch (e) {
            console.log(`⚠️ Erro no termo "${termo}": ${e.message}`);
        }
    }

    candidatos.sort((a, b) => b.desconto - a.desconto);
    const escolhidos = candidatos.slice(0, MAX_POR_EXECUCAO);
    for (const c of escolhidos) c.link = await linkAfiliado(headers, c);
    return escolhidos;
}

// Categoria define o tom da narracao do video (suplemento fala de treino,
// equipamento fala de academia em casa, e assim por diante).
function categoriaDe(titulo) {
    const t = (titulo || '').toLowerCase();
    if (/whey|creatina|glutamina|albumina|pre.?treino|bcaa|vitamina|colageno|termog/.test(t)) return 'suplemento';
    if (/halter|banco|barra|esteira|bike|anilha|kettlebell|eliptico|supino/.test(t))          return 'equipamento';
    if (/legging|blusa|camiseta|short|top |conjunto|regata|tenis/.test(t))                     return 'moda';
    return 'acessorio';
}

async function postarProduto(token, chatId, resultado) {
    await baixarImagem(resultado.thumbnail, 'foto.jpg');

    let msg = `🟡 <b>MERCADO LIVRE</b>\n`;
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `🔥 <b>OFERTA!</b>\n\n`;
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
    if (!json.ok) throw new Error('Telegram recusou: ' + JSON.stringify(json));
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não definidos!');
        process.exit(1);
    }

    // Lê histórico de IDs postados para evitar repetição
    const ultimosIds = fs.existsSync('ultimo_id.txt')
        ? fs.readFileSync('ultimo_id.txt', 'utf8').trim().split(',').filter(Boolean)
        : [];
    if (ultimosIds.length) console.log(`📌 Histórico: ${ultimosIds.length} produtos já postados`);

    try {
        const mlToken  = await renovarTokenML();
        const produtos = await buscarOfertas(mlToken, ultimosIds);
        if (produtos.length === 0) {
            // rodada sem oferta boa não é erro: só não posta (próxima rodada tenta outros termos)
            console.log(`😴 Nenhuma oferta com ${DESCONTO_MINIMO}%+ nesta rodada. Nada postado.`);
            return;
        }

        console.log(`\n📦 ${produtos.length} produto(s) encontrado(s). Postando...\n`);

        const idsPostados = [];
        for (const produto of produtos) {
            try {
                console.log(`🔗 Postando: ${produto.titulo}`);
                await postarProduto(token, chatId, produto);
                idsPostados.push(produto.id);

                // --- entrega a oferta para o gerador de video ---
                // foto.jpg ja foi baixada por postarProduto, entao o Python reaproveita.
                fs.writeFileSync('produto_do_dia.json', JSON.stringify({
                    id:             produto.id,
                    titulo:         produto.titulo,
                    preco:          produto.preco,
                    preco_original: produto.precoOriginal,
                    fotos:          [produto.thumbnail],
                    foto_local:     'foto.jpg',
                    link:           produto.link,
                    frete_gratis:   !!produto.freteGratis,
                    categoria:      categoriaDe(produto.titulo)
                }, null, 2));
                console.log('🎬 produto_do_dia.json gravado para o gerador de vídeo');
                console.log(`✅ Postado!\n`);
                // Pequena pausa entre posts para não sobrecarregar o Telegram
                if (produtos.indexOf(produto) < produtos.length - 1) {
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (e) {
                console.error(`❌ Falha ao postar "${produto.titulo}": ${e.message}`);
            }
        }

        if (idsPostados.length === 0) throw new Error('Nenhum produto foi postado com sucesso');

        // Salva histórico (mantém os últimos MAX_IDS_HISTORICO)
        const novoHistorico = [...ultimosIds, ...idsPostados].slice(-MAX_IDS_HISTORICO);
        fs.writeFileSync('ultimo_id.txt', novoHistorico.join(','));
        console.log(`✅ ${idsPostados.length} produto(s) postado(s) com sucesso!`);

    } catch (e) {
        console.error('❌ Erro: ' + e.message);

        try {
            const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID;
            if (token && adminId) {
                fs.writeFileSync('erro.txt', `⚠️ <b>Erro no Bot:</b>\n\n${e.message}`);
                execSync(`curl -s --max-time 15 -X POST "https://api.telegram.org/bot${token}/sendMessage" -F chat_id="${adminId}" -F text="<erro.txt" -F parse_mode="HTML"`, { timeout: 20000 });
            }
        } catch (err2) {}

        process.exit(1);
    }
}

iniciar();
