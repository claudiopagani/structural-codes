"""Extract the thirteen figures of Circolare 2019 § C4.1 from the official PDF.

Coordinates are expressed in PDF points from the top-left corner. Figure
C4.1.10 crosses a page boundary and is therefore reconstructed from the
bottom of page 91 and the top of page 92.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

from lib.poppler import resolve_pdftoppm


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
MANIFEST = REPO / "corpus" / "assets" / "circ2019" / "core-figure-placeholders.json"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "circ2019"
PDFTOPPM = resolve_pdftoppm()
RESOLUTION = 300
SCALE = RESOLUTION / 72


FIGURES = {
    "C4.1.1": {
        "page": 86,
        "bbox": (150, 330, 445, 486),
        "caption": "Figura C4.1.1 – Ridistribuzione dei momenti per travi continue",
    },
    "C4.1.2": {
        "page": 86,
        "bbox": (120, 575, 475, 725),
        "caption": (
            "Figura C4.1.2 – Diagramma delle sollecitazioni e schema dei momenti "
            "trasmessi al nodo con momenti d’estremità discordi"
        ),
    },
    "C4.1.3": {
        "page": 87,
        "bbox": (125, 95, 470, 248),
        "caption": (
            "Figura C4.1.3 – Diagramma delle sollecitazioni e schema dei momenti "
            "trasmessi al nodo con momenti d’estremità concordi"
        ),
    },
    "C4.1.4": {
        "page": 87,
        "bbox": (85, 285, 510, 435),
        "caption": (
            "Figura C4.1.4 – Momenti d’estremità di verso opposto: "
            "ridistribuzione del momento nelle travi"
        ),
    },
    "C4.1.5": {
        "page": 87,
        "bbox": (85, 438, 520, 604),
        "caption": (
            "Figura C4.1.5 – Momenti d’estremità di verso concorde: "
            "ridistribuzione dei momenti nelle travi"
        ),
    },
    "C4.1.6": {
        "page": 88,
        "bbox": (115, 95, 480, 248),
        "caption": (
            "Figura C4.1.6 – Diagrammi dei momenti a seguito della "
            "ridistribuzione dei momenti nelle travi"
        ),
    },
    "C4.1.7": {
        "page": 88,
        "bbox": (105, 515, 490, 661),
        "caption": (
            "Figura C4.1.7 – Pressione laterale di confinamento: "
            "(a) sezioni circolari, (b) sezioni rettangolari"
        ),
    },
    "C4.1.8": {
        "page": 89,
        "bbox": (115, 135, 520, 270),
        "caption": (
            "Figura C4.1.8 – Rapporto tra il volume di calcestruzzo "
            "effettivamente confinato e il volume di calcestruzzo racchiuso "
            "dalle staffe"
        ),
    },
    "C4.1.9": {
        "page": 89,
        "bbox": (145, 365, 450, 632),
        "caption": (
            "Figura C4.1.9 – Legame tensione-deformazione del calcestruzzo "
            "confinato con ramo “softening”"
        ),
    },
    "C4.1.10": {
        "page": 91,
        "bbox": (175, 560, 430, 700),
        "continuation": {"page": 92, "bbox": (175, 90, 430, 178)},
        "caption": "Figura C4.1.10 – Area tesa efficace. Casi tipici",
    },
    "C4.1.11": {
        "page": 92,
        "bbox": (145, 575, 460, 695),
        "caption": (
            "Figura C4.1.11 – Ampiezza delle fessure, w, in funzione della "
            "posizione rispetto alle barre di armatura"
        ),
    },
    "C4.1.12": {
        "page": 94,
        "bbox": (175, 95, 420, 205),
        "caption": (
            "Figura C4.1.12 – Relazione momento-curvatura. "
            "Fattore di duttilità di curvatura"
        ),
    },
    "C4.1.13": {
        "page": 98,
        "bbox": (195, 90, 375, 183),
        "continuation": {"page": 98, "bbox": (195, 186, 450, 200)},
        "caption": (
            "Figura C4.1.13 – Modelli σ-ε per il calcestruzzo di aggregati leggeri"
        ),
    },
}


def pixels(bbox: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    return tuple(round(value * SCALE) for value in bbox)  # type: ignore[return-value]


def render_pages(pages: set[int], temp: Path) -> dict[int, Path]:
    rendered: dict[int, Path] = {}
    for page in sorted(pages):
        prefix = temp / f"page-{page:03d}"
        subprocess.run(
            [
                str(PDFTOPPM),
                "-f",
                str(page),
                "-l",
                str(page),
                "-r",
                str(RESOLUTION),
                "-png",
                "-singlefile",
                str(PDF),
                str(prefix),
            ],
            check=True,
        )
        rendered[page] = prefix.with_suffix(".png")
    return rendered


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pages = {spec["page"] for spec in FIGURES.values()}
    pages.update(
        spec["continuation"]["page"]
        for spec in FIGURES.values()
        if "continuation" in spec
    )

    with tempfile.TemporaryDirectory(prefix="circ41-figures-") as directory:
        rendered = render_pages(pages, Path(directory))

        for number, spec in FIGURES.items():
            with Image.open(rendered[spec["page"]]) as page_image:
                figure = page_image.crop(pixels(spec["bbox"]))

            if "continuation" in spec:
                continuation = spec["continuation"]
                with Image.open(rendered[continuation["page"]]) as page_image:
                    tail = page_image.crop(pixels(continuation["bbox"]))
                width = max(figure.width, tail.width)
                combined = Image.new("RGB", (width, figure.height + tail.height), "white")
                combined.paste(figure, ((width - figure.width) // 2, 0))
                combined.paste(tail, ((width - tail.width) // 2, figure.height))
                figure = combined

            output = OUTPUT_DIR / f"figc4.1.{number.rsplit('.', 1)[-1]}.png"
            figure.save(output, "PNG", optimize=True)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_number = {figure["officialNumber"]: figure for figure in manifest["figures"]}
    for number, spec in FIGURES.items():
        entry = by_number[number]
        output = OUTPUT_DIR / f"figc4.1.{number.rsplit('.', 1)[-1]}.png"
        x0, y0, x1, y1 = spec["bbox"]
        entry.update(
            {
                "pdfPage": spec["page"],
                "caption": spec["caption"],
                "alt": spec["caption"],
                "imagePath": f"figures/circ2019/{output.name}",
                "region": {
                    "coordinateSystem": "pdf-points-top-left",
                    "x": x0,
                    "y": y0,
                    "width": x1 - x0,
                    "height": y1 - y0,
                },
                "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
            }
        )

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"circ41-figures: extracted {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
