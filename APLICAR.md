# Como aplicar no repo `promocoes-reais` — 5 minutos

Não consigo dar o commit por você: o proxy desta sessão bloqueia escrita no seu
repositório ("not in this session's authorized repository set"). Mas li o seu
código de verdade, então o patch abaixo usa os **nomes reais** das suas
variáveis — não é palpite.

---

## 1. Copie os arquivos novos

Do zip, para a raiz do repo:

```
src/                        (pasta inteira)
assets/personagem/          (os 3 clipes validados)
gerar_video.py
requirements.txt
.github/workflows/gerar-video.yml
```

## 2. Aplique o patch no `atualizar_ofertas.js`

Copie `patch-atualizar-ofertas.diff` para a raiz do repo e rode:

```bash
git apply patch-atualizar-ofertas.diff
node --check atualizar_ofertas.js     # deve passar sem erro
```

Se `git apply` reclamar (caso você tenha editado o arquivo desde o clone),
aplique as 3 mudanças na mão — elas estão descritas no próprio .diff.

### O que o patch faz

| Onde | Mudança |
|---|---|
| linha ~107 | passa a capturar `freteGratis` do produto |
| antes de `postarProduto` | adiciona `categoriaDe()`, que define o tom da narração |
| dentro do loop de `iniciar()` | grava `produto_do_dia.json` logo após o post dar certo |

**Nada do que já funciona é alterado.** O bot continua buscando no ML e postando
no Telegram exatamente como hoje.

## 3. Commit e teste

```bash
git add -A
git commit -m "feat: gerar video da oferta do dia"
git push
```

Depois, no GitHub: aba **Actions** → "Gerar vídeo da oferta" → **Run workflow**.

---

## O que observar na primeira execução

| Passo do log | O que confirma |
|---|---|
| `🎬 produto_do_dia.json gravado` | o patch pegou |
| `[fotos] reaproveitando foto.jpg` | não precisou rebaixar a imagem |
| `[clipes] ...` | achou o banco de personagem |
| `[voz] XX.Xs` **sem** a linha `edge-tts indisponível` | **a voz neural funcionou** |
| `[recorte] personagem em NN%` | detecção de rosto acertou |
| vídeo chegando no seu Telegram admin | pipeline inteiro fechado |

A linha da voz é a mais importante. Se aparecer `edge-tts indisponível` no
Actions, me avise — aí é problema real, não limitação do meu ambiente.

## Se falhar

Copie o log da execução e me mande. Os erros mais prováveis:

- **`nenhum clipe em assets/personagem`** → os .mp4 não subiram (Git às vezes
  ignora binários por `.gitignore`)
- **`produto_do_dia.json` não existe** → o bot não achou oferta naquela rodada;
  rode de novo
- **fonte Poppins faltando** → o passo de instalar fontes falhou; o vídeo sai
  com DejaVu e fica feio, mas não quebra
