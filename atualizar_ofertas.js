const fs = require('fs');
const { execSync } = require('child_process');

const MELI_APP_ID = '7346131242004348';
const MELI_ID     = 'daje8667974';

const MAX_POR_EXECUCAO = 1; // produtos postados por rodada
const MAX_IDS_HISTORICO = 100; // IDs guardados para evitar repetição

const TERMOS_BUSCA = [
    // Suplementos
    'whey protein', 'creatina', 'colageno hidrolisado', 'vitamina c', 'omega 3', 'pre treino',
    'bcaa', 'glutamina', 'proteina vegana', 'albumina',
    // Roupas e acessórios
    'tenis corrida', 'legging fitness', 'bermuda academia', 'camiseta dry fit', 'top fitness',
    // Equipamentos
    'halteres', 'kettlebell', 'corda pular', 'colchonete yoga', 'faixa elastica resistencia',
    'barra musculacao', 'anilha academia', 'step aerobico',
    // Tecnologia fitness
    'smartwatch fitness', 'monitor frequencia cardiaca', 'bike ergometrica',
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

    const ids = buscaData.results.map(p => p.id).filter(id => !ultimosIds.includes(id));
    const resultados = [];

    for (const id of ids) {
        if (resultados.length >= limite) break;

        const resProd = await fetchComTimeout(`https://api.mercadolibre.com/products/${id}`, { headers }, 20000);
        if (!resProd.ok) continue;
        const prod = await resProd.json();

        const resItems = await fetchComTimeout(`https://api.mercadolibre.com/products/${id}/items`, { headers }, 20000);
        if (!resItems.ok) continue;
        const itemsData = await resItems.json();
        if (!itemsData.results?.length) continue;

        const temDesconto10 = (i) => i.price && i.original_price && ((i.original_price - i.price) / i.original_price) >= 0.10;
        const item = itemsData.results.find(temDesconto10) || itemsData.results.find(i => i.price);
        if (!item) continue;

        const itemId = item.id || (itemsData.results[0] && itemsData.results[0].id);
        let permalink = `https://www.mercadolivre.com.br/p/${id}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
        if (itemId) {
            const resDetalhe = await fetchComTimeout(`https://api.mercadolibre.com/items/${itemId}`, { headers }, 15000);
            if (resDetalhe.ok) {
                const detalhe = await resDetalhe.json();
                if (detalhe.permalink) permalink = `${detalhe.permalink}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
            }
        }

        const preco         = item.price;
        const precoOriginal = item.original_price || null;
        const desconto      = precoOriginal ? Math.round(((precoOriginal - preco) / precoOriginal) * 100) : null;
        const img           = (prod.pictures?.[0]?.url || '').replace(/-[A-Z]\.jpg$/, '-J.jpg');
        if (!img) continue;

        console.log(`✅ Produto encontrado: ${prod.name} — R$ ${preco}${desconto ? ` (${desconto}% OFF)` : ''}`);
        resultados.push({ id, titulo: prod.name, preco, precoOriginal, desconto, link: permalink, thumbnail: img });
    }

    return resultados;
}

async function buscarOfertas(mlToken, ultimosIds) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const slot    = Math.floor(Date.now() / (15 * 60 * 1000));
    const todos   = [];

    for (let i = 0; i < TERMOS_BUSCA.length && todos.length < MAX_POR_EXECUCAO; i++) {
        const termo    = TERMOS_BUSCA[(slot + i) % TERMOS_BUSCA.length];
        const faltam   = MAX_POR_EXECUCAO - todos.length;
        console.log(`🔎 Buscando: "${termo}" (faltam ${faltam} produtos)`);
        try {
            const encontrados = await buscarPorTermo(headers, termo, [...ultimosIds, ...todos.map(p => p.id)], faltam);
            todos.push(...encontrados);
            if (encontrados.length === 0) console.log(`⚠️ Sem produto válido para "${termo}"`);
        } catch (e) {
            console.log(`⚠️ Erro no termo "${termo}": ${e.message}`);
        }

        if (todos.length >= MAX_POR_EXECUCAO) break;
    }

    if (todos.length === 0) throw new Error('Nenhum produto encontrado em nenhum termo');
    return todos;
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

        console.log(`\n📦 ${produtos.length} produto(s) encontrado(s). Postando...\n`);

        const idsPostados = [];
        for (const produto of produtos) {
            try {
                console.log(`🔗 Postando: ${produto.titulo}`);
                await postarProduto(token, chatId, produto);
                idsPostados.push(produto.id);
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
