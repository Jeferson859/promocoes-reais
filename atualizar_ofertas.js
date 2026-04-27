const https = require('https');

const token = process.env.BOT_TOKEN || 'SEU_TOKEN_AQUI';

let offset = 0;

function getUpdates() {
  const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=30`;
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const updates = JSON.parse(data);
        if (updates.ok) {
          updates.result.forEach((update) => {
            offset = update.update_id + 1;
            const message = update.message;
            if (message) {
              const chatId = message.chat.id;
              const text = message.text || '';
              if (text === '/start') {
                sendMessage(chatId, 'Olá! Bot funcionando corretamente.');
              } else if (text === '/photo') {
                sendPhoto(chatId);
              } else {
                sendMessage(chatId, `Você disse: ${text}`);
              }
            }
          });
        }
      } catch (e) {
        console.error('Erro ao processar updates:', e.message);
      }
      setTimeout(getUpdates, 1000);
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

  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      console.log(`Mensagem enviada para ${chatId}`);
    });
  });

  req.on('error', (e) => {
    console.error(`Erro ao enviar mensagem: ${e.message}`);
  });

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

  req.write(postData);
  req.end();
}

console.log('Bot Telegram iniciado. Defina BOT_TOKEN no ambiente.');
getUpdates();
