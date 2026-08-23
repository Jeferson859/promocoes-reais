"""Ponto de entrada do CI: recebe um produto em JSON, devolve um mp4.

Feito para rodar dentro do fluxo que já existe no repo promocoes-reais:
o atualizar_ofertas.js escolhe a oferta do dia e grava produto_do_dia.json;
este script transforma essa oferta em vídeo.

    python3 gerar_video.py produto_do_dia.json saida/oferta.mp4

Sai com código 2 se não houver clipe de personagem — assim o workflow
sinaliza "faltou material" em vez de gerar um vídeo quebrado.
"""
import json
import random
import sys
from pathlib import Path

from src.modelos import Produto
from src import roteiro as mod_roteiro, tts, fotos
from src.video_b import montar_b

BASE = Path(__file__).parent
CLIPES = BASE / "assets" / "personagem"

# Estrutura do vídeo: qual categoria de clipe entra em cada momento.
ORDEM = ["gancho", "apresenta", "preco", "cta"]


def escolher_clipes(semente: str) -> list[Path]:
    """Sorteia um clipe de cada categoria, para o vídeo nunca repetir igual."""
    rnd = random.Random(semente)
    escolhidos: list[Path] = []
    for cat in ORDEM:
        opcoes = sorted(CLIPES.glob(f"{cat}_*.mp4"))
        if opcoes:
            escolhidos.append(rnd.choice(opcoes))
    if not escolhidos:                      # nenhuma categoria batendo
        escolhidos = sorted(CLIPES.glob("*.mp4"))
    return escolhidos


def main() -> int:
    entrada = Path(sys.argv[1] if len(sys.argv) > 1 else "produto_do_dia.json")
    saida = Path(sys.argv[2] if len(sys.argv) > 2 else "saida/oferta.mp4")

    if not entrada.exists():
        print(f"[erro] não achei {entrada}")
        return 1

    dados = json.loads(entrada.read_text(encoding="utf-8"))
    if isinstance(dados, list):
        dados = dados[0]

    p = Produto(
        id=str(dados.get("id", "")),
        titulo=dados.get("titulo") or dados.get("title", ""),
        preco=float(dados.get("preco") or dados.get("price") or 0),
        preco_original=(float(dados["preco_original"])
                        if dados.get("preco_original") else None),
        fotos=dados.get("fotos") or ([dados["img"]] if dados.get("img") else []),
        link=dados.get("link", ""),
        frete_gratis=bool(dados.get("frete_gratis")),
        categoria=dados.get("categoria", "suplemento"),
    )

    if p.preco <= 0 or not p.titulo:
        print("[erro] produto sem preço ou sem título")
        return 1

    print(f"[produto] {p.titulo[:60]} — {p.preco_fmt()} ({p.desconto_pct}% OFF)")

    # 1) roteiro
    r = mod_roteiro.gerar(p)
    print(f"[roteiro] {r.gancho} | {r.narracao[:70]}...")

    # 2) fotos — o bot Node já baixou foto.jpg ao postar no Telegram.
    # Reaproveitar evita um download a mais e um ponto de falha a menos.
    arquivos = []
    local = dados.get("foto_local")
    if local and Path(local).exists():
        print(f"[fotos] reaproveitando {local} (baixada pelo bot)")
        arquivos = [Path(local)]
    else:
        arquivos = fotos.baixar(p.fotos, BASE / "tmp" / "fotos")
    if not arquivos:
        print("[aviso] nenhuma foto utilizável — vídeo sai sem card de produto")

    # 3) clipes do personagem
    clipes = escolher_clipes(p.hash)
    if not clipes:
        print(f"[erro] nenhum clipe em {CLIPES}. Gere o banco antes.")
        return 2
    print(f"[clipes] {', '.join(c.name for c in clipes)}")

    # 4) narração
    audio = tts.narrar(r.narracao, BASE / "tmp" / "narracao.mp3")
    dur = tts.duracao(audio)
    print(f"[voz] {dur:.1f}s")

    # 5) render
    out = montar_b(p, r, clipes, audio, dur, saida=saida,
                   foto=arquivos[0] if arquivos else None,
                   tmp=BASE / "tmp")
    print(f"[pronto] {out}")

    # 6) metadados para o publicador
    meta = saida.with_suffix(".json")
    meta.write_text(json.dumps({
        "arquivo": str(out),
        "titulo_youtube": r.titulo_youtube,
        "legenda": r.legenda_completa,
        "hashtags": r.hashtags,
        "produto": p.titulo,
        "preco": p.preco,
        "link": p.link,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[meta] {meta}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
