# Integração com o repo `promocoes-reais`

O bot que você já tem funciona. Este pacote **não substitui nada** — ele acopla
a geração de vídeo ao fluxo que já roda.

```
HOJE:      busca oferta no ML  →  posta no Telegram
DEPOIS:    busca oferta no ML  →  posta no Telegram
                              ↘   grava produto_do_dia.json  →  gera vídeo
```

A única mudança no seu código Node é **gravar um arquivo**. Nada do que já
funciona é tocado.

---

## Passo 1 — Copiar os arquivos para o repo

```
promocoes-reais/
├── atualizar_ofertas.js          ← só ganha 4 linhas (passo 2)
├── requirements.txt              ← NOVO
├── gerar_video.py                ← NOVO
├── src/                          ← NOVO (pasta inteira)
│   ├── modelos.py  roteiro.py  tts.py  fotos.py
│   ├── video.py    video_b.py
│   └── fontes/
├── assets/
│   └── personagem/               ← NOVO — os clipes do Veo
│       ├── gancho_02.mp4
│       ├── apresenta_01.mp4
│       └── cta_01.mp4
└── .github/workflows/
    └── gerar-video.yml           ← NOVO
```

---

## Passo 2 — A única alteração no `atualizar_ofertas.js`

Onde o script já decidiu qual produto vai postar, adicione a gravação do JSON.
Procure o trecho que monta a mensagem do Telegram e acrescente **antes ou
depois** dele:

```js
// --- grava a oferta escolhida para o gerador de vídeo ---
const fs = require('fs');
fs.writeFileSync('produto_do_dia.json', JSON.stringify({
  id:             item.id,
  titulo:         item.title,
  preco:          item.price,
  preco_original: item.original_price || null,
  fotos:          [item.thumbnail],          // ou item.pictures?.map(p => p.url)
  link:           linkAfiliado,              // use a variável do seu link
  frete_gratis:   !!(item.shipping && item.shipping.free_shipping),
  categoria:      'suplemento'               // suplemento | equipamento | acessorio | moda
}, null, 2));
```

> **Ajuste os nomes das variáveis** (`item`, `linkAfiliado`) para os que existem
> no seu arquivo. Eu não consegui ler o código linha a linha — só a estrutura —
> então esses nomes são o padrão, não necessariamente os seus.

### Sobre a `categoria`

É ela que muda o tom da narração: suplemento fala de treino, equipamento fala de
academia em casa, acessório fala de custo-benefício. Se quiser automático, dá
para deduzir do título:

```js
const t = item.title.toLowerCase();
const categoria =
  /whey|creatina|glutamina|albumina|pré.?treino|bcaa|vitamina/.test(t) ? 'suplemento' :
  /halter|banco|barra|esteira|bike|anilha|kettlebell/.test(t)          ? 'equipamento' :
  /legging|blusa|camiseta|short|top|conjunto/.test(t)                  ? 'moda' :
                                                                         'acessorio';
```

---

## Passo 3 — Os clipes do personagem

Coloque os `.mp4` do Veo em `assets/personagem/`, com nomes que começem pela
categoria. O gerador sorteia **um de cada** para montar o vídeo:

| Prefixo | Momento | Quantos você tem |
|---|---|---|
| `gancho_*` | abre o vídeo | 1 |
| `apresenta_*` | apresenta o produto | 1 |
| `preco_*` | reação ao preço | 0 |
| `cta_*` | chamada pro Telegram | 1 |

Com poucos clipes ele funciona, mas repete. Quanto mais variação, menos o feed
cansa — que é o que derruba alcance nesse tipo de conteúdo.

> Se a pasta estiver vazia, o script sai com código **2** e o workflow acusa
> "faltou material" em vez de gerar um vídeo quebrado.

---

## Passo 4 — Secrets

O workflow usa os secrets que **já existem** no seu repo:

`MELI_CLIENT_ID` · `MELI_CLIENT_SECRET` · `ML_REFRESH` ·
`TELEGRAM_TOKEN` · `TELEGRAM_CHAT_ID` · `TELEGRAM_ADMIN_CHAT_ID`

Nenhum secret novo é necessário nesta etapa. Os do YouTube entram depois que a
auditoria for aprovada.

---

## Passo 5 — Testar sem esperar o horário

Na aba **Actions** do GitHub, escolha "Gerar vídeo da oferta" e clique em
**Run workflow**. O `workflow_dispatch` existe justamente para isso.

Ao terminar, o vídeo chega em dois lugares: como artefato para download na
página da execução, e **no seu Telegram admin**, pronto para você publicar
manualmente enquanto as aprovações não saem.

---

## O que ainda não está aqui

- **Publicação automática** no YouTube, Instagram e TikTok — depende das
  aprovações da Fase 0.
- **Voz neural.** O `edge-tts` está no `requirements.txt` e **funciona no
  GitHub Actions**. Nos meus testes locais ele caiu no espeak (voz robótica)
  porque meu ambiente bloqueia o endpoint da Microsoft — no Actions isso não
  acontece. A primeira execução real é onde você vai ouvir a voz de verdade.
- **Música de fundo.** Coloque um arquivo em `assets/musica.mp3` e ele entra
  automaticamente, em volume baixo, por baixo da narração.
