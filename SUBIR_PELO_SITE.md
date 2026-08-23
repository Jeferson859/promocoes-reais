# Subir tudo pelo site do GitHub — sem terminal

Você não precisa de git nem de linha de comando. O `atualizar_ofertas.js` deste
pacote **já está corrigido** — é só substituir o antigo.

---

## Passo 1 — Descompacte o zip

Você vai ter esta estrutura:

```
atualizar_ofertas.js     ← JÁ CORRIGIDO, substitui o seu
gerar_video.py
requirements.txt
src/                     (pasta)
assets/personagem/       (pasta, com os 3 clipes)
.github/workflows/       (pasta)
```

## Passo 2 — Abra o repositório

https://github.com/Jeferson859/promocoes-reais

Clique em **Add file** → **Upload files**.

## Passo 3 — Arraste TUDO de uma vez

Selecione todos os itens descompactados (arquivos **e** pastas) e arraste para a
área de upload. O GitHub aceita pastas inteiras e mantém a estrutura.

> ⚠️ A pasta `.github` começa com ponto e o Windows pode escondê-la.
> Ative **Exibir → Itens ocultos** no Explorador antes de selecionar.

## Passo 4 — Confirme o commit

Na caixa de mensagem escreva algo como `gerar video da oferta do dia` e clique
em **Commit changes**.

O GitHub vai avisar que `atualizar_ofertas.js` já existe e será substituído.
**É isso mesmo** — a versão nova tem suas 3 alterações.

## Passo 5 — Rode

Aba **Actions** → **Gerar vídeo da oferta** → botão **Run workflow** →
**Run workflow** de novo, no menu que abre.

Aguarde de 3 a 6 minutos.

---

## O que olhar no log

Clique na execução e abra o passo **Renderizar**. Procure estas linhas:

| Linha esperada | Significa |
|---|---|
| `🎬 produto_do_dia.json gravado` | o JS novo entrou no ar |
| `[fotos] reaproveitando foto.jpg` | achou a foto que o bot já tinha baixado |
| `[clipes] gancho_XX.mp4, ...` | achou o banco do personagem |
| `[voz] 23.5s` **sem** aviso acima | 🎯 **a voz neural funcionou** |
| `[pronto] saida/oferta.mp4` | vídeo criado |

E o vídeo chega no seu **Telegram admin**.

---

## Se aparecer erro

Copie o texto do passo que ficou vermelho e me mande. Os mais prováveis:

- **`nenhum clipe em assets/personagem`** → os .mp4 não subiram. Repita o upload
  só da pasta `assets`.
- **`produto_do_dia.json` não existe** → o bot não achou oferta nessa rodada.
  Rode o workflow de novo.
- **`edge-tts indisponível`** → aí sim é problema real. Me avise.
