const fs = require('fs');
const { execSync } = require('child_process');

const MELI_APP_ID = '7346131242004348';
const MELI_ID     = 'daje8667974';

const OFERTAS = [
    { loja: 'Mercado Livre', emoji: '🟡', produto: 'fitness', link: null }
];

const TERMOS_BUSCA = ['whey protein', 'creatina', 'smartwatch fitness', 'tenis corrida', 'halteres', 'colageno'];

function fetchComTimeout(url, opcoes = {}, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opcoes, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

async function baixarImagem(url, destino) {
    const res = await fetchComTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
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
    if (!data.access_token) throw new Error('Token ML falhou: ' + JSON.stringify(data));
    console.log('✅ Token ML renovado!');
    return data.access_token;
}

async function buscarOfertaML(mlToken) {
    const headers = { 'Authorization': `Bearer ${mlToken}` };
    const minutos = new Date().getUTCMinutes();
    const termo   = TERMOS_BUSCA[minutos % TERMOS_BUSCA.length];

    const resBusca = await fetchComTimeout(
        `https://api.mercadolibre.com/products/search?status=active&site_id=MLB&q=${encodeURIComponent(termo)}&limit=20`,
        { headers },
        30000
    );
    if (!resBusca.ok) {
        const corpo = await resBusca.text();
        throw new Error(`Falha na busca (${resBusca.status}): ${corpo}`);
    }

    const buscaData = await resBusca.json();
    if (!buscaData.results || buscaData.results.length === 0) throw new Error('Nenhum produto encontrado na busca');

    const ids = buscaData.results.map(p => p.id);

    // Para cada produto, busca os itens reais que têm preço
    for (const id of ids.slice(0, 5)) {
        const resProd  = await fetchComTimeout(`https://api.mercadolibre.com/products/${id}`, { headers }, 20000);
        if (!resProd.ok) { console.log(`⚠️ Produto ${id} retornou ${resProd.status}`); continue; }
        const prod = await resProd.json();

        const resItems = await fetchComTimeout(`https://api.mercadolibre.com/products/${id}/items`, { headers }, 20000);
        if (!resItems.ok) { console.log(`⚠️ Itens de ${id} retornou ${resItems.status}`); continue; }
        const itemsData = await resItems.json();

        const item = itemsData.results?.find(i => i.price);
        if (!item) { console.log(`⚠️ Itens de ${id} sem preço`); continue; }

        const preco         = item.price;
        const precoOriginal = item.original_price || null;
        const desconto      = precoOriginal ? Math.round(((precoOriginal - preco) / precoOriginal) * 100) : null;
        const permalink     = item.permalink
            ? `${item.permalink}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`
            : `https://www.mercadolivre.com.br/p/${id}?matt_tool=${MELI_APP_ID}&utm_campaign=${MELI_ID}`;
        const img           = (prod.pictures?.[0]?.url || '').replace(/-[A-Z]\.jpg$/, '-J.jpg');
        if (!img) continue;

        console.log(`✅ Produto com preço: ${prod.name} — R$ ${preco}`);
        return { titulo: prod.name, preco, precoOriginal, desconto, link: permalink, thumbnail: img };
    }

    throw new Error('Nenhum dos 5 primeiros produtos tinha itens com preço');
}

async function iniciar() {
    const token  = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('❌ TELEGRAM_TOKEN ou TELEGRAM_CHAT_ID não definidos!');
        process.exit(1);
    }

    try {
        const oferta = OFERTAS[0];
        console.log(`🏪 Loja: ${oferta.loja}`);

        const mlToken   = await renovarTokenML();
        const resultado = await buscarOfertaML(mlToken);

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

        try {
            const t = process.env.TELEGRAM_TOKEN;
            const c = process.env.TELEGRAM_CHAT_ID;
            if (t && c) {
                const msgErro = `⚠️ <b>Erro no Bot:</b>\n\n${e.message}\n\n<i>Se o erro for sobre o Token do ML, será necessário gerar um novo refresh_token.</i>`;
                execSync(`curl -s --max-time 15 -X POST "https://api.telegram.org/bot${t}/sendMessage" -F chat_id="${c}" -F text="${msgErro}" -F parse_mode="HTML"`, { timeout: 20000 });
            }
        } catch (err2) {}

        process.exit(1);
    }
}

iniciar();
