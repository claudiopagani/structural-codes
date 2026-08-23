"""Extract the ten official figures of Circolare 2019 C3, editorial step 3."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from lib.poppler import resolve_pdftoppm


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
MANIFEST = REPO / "corpus" / "assets" / "circ2019" / "core-figure-placeholders.json"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "circ2019"
PDFTOPPM = resolve_pdftoppm()
RESOLUTION = 300
SCALE = RESOLUTION / 72


FIGURES = {
    "C3.3.26": {
        "unit": "c3.3.8.3",
        "page": 72,
        "bbox": (145, 88, 455, 268),
        "caption": "Figura C3.3.26 – Coefficiente di pressione esterna cpe0",
    },
    "C3.3.27": {
        "unit": "c3.3.8.4",
        "page": 73,
        "bbox": (145, 88, 455, 430),
        "caption": "Figura C3.3.27 – Schema di riferimento per cupole sferiche",
    },
    "C3.3.28": {
        "unit": "c3.3.8.6.2",
        "page": 74,
        "bbox": (205, 255, 395, 430),
        "caption": "Figura C3.3.28 – Travi parallele",
    },
    "C3.4.1": {
        "unit": "c3.4.2",
        "page": 76,
        "bbox": (73, 438, 522, 633),
        "caption": (
            "Figura C3.4.1 – Adattamento del carico della neve al suolo al "
            "variare del periodo di ritorno (coefficiente di variazione v = 0,6)"
        ),
    },
    "C3.4.2": {
        "unit": "c3.4.3.1",
        "page": 77,
        "bbox": (175, 270, 425, 405),
        "caption": "Figura C3.4.2 – Coefficienti di forma per il carico neve",
    },
    "C3.4.3": {
        "unit": "c3.4.3.3",
        "page": 78,
        "bbox": (175, 125, 425, 285),
        "caption": (
            "Figura C3.4.3 – Coefficiente di forma per il carico neve – "
            "Coperture a più falde"
        ),
    },
    "C3.4.4": {
        "unit": "c3.4.3.3.1",
        "page": 78,
        "bbox": (73, 442, 522, 610),
        "caption": (
            "Figura C3.4.4 – Coefficiente di forma per il carico neve – "
            "Coperture cilindriche"
        ),
    },
    "C3.4.5": {
        "unit": "c3.4.3.3.2",
        "page": 79,
        "bbox": (73, 118, 522, 310),
        "caption": (
            "Figura C3.4.5 – Coefficiente di forma per il carico neve – "
            "Coperture adiacenti a costruzioni più alte"
        ),
    },
    "C3.4.6": {
        "unit": "c3.4.3.3.4",
        "page": 80,
        "bbox": (73, 118, 522, 242),
        "caption": (
            "Figura C3.4.6 – Coefficienti di forma per il carico neve in "
            "corrispondenza di sporgenze ed ostruzioni"
        ),
    },
    "C3.4.7": {
        "unit": "c3.4.3.3.5",
        "page": 80,
        "bbox": (73, 435, 522, 562),
        "caption": "Figura C3.4.7 – Neve aggettante dal bordo di una copertura",
    },
}


def render_crop(
    page: int,
    bbox: tuple[int, int, int, int],
    destination: Path,
) -> None:
    x1, y1, x2, y2 = bbox
    prefix = destination.with_suffix("")
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
            "-x",
            str(round(x1 * SCALE)),
            "-y",
            str(round(y1 * SCALE)),
            "-W",
            str(round((x2 - x1) * SCALE)),
            "-H",
            str(round((y2 - y1) * SCALE)),
            str(PDF),
            str(prefix),
        ],
        check=True,
    )


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if not PDFTOPPM.exists():
        raise FileNotFoundError(f"pdftoppm non trovato: {PDFTOPPM}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    reviewed = set(FIGURES)
    manifest["figures"] = [
        figure
        for figure in manifest["figures"]
        if figure.get("officialNumber") not in reviewed
    ]

    for number, spec in FIGURES.items():
        filename = f"fig{number.lower()}.png"
        destination = OUTPUT_DIR / filename
        render_crop(spec["page"], spec["bbox"], destination)
        x1, y1, x2, y2 = spec["bbox"]
        manifest["figures"].append(
            {
                "id": (
                    "urn:structural-codes:it:asset:figure:circ2019:"
                    f"{number.lower()}"
                ),
                "unitId": (
                    "urn:structural-codes:it:unit:circ2019:"
                    f"{spec['unit']}"
                ),
                "officialNumber": number,
                "pdfPage": spec["page"],
                "caption": spec["caption"],
                "alt": spec["caption"],
                "imagePath": f"figures/circ2019/{filename}",
                "region": {
                    "coordinateSystem": "pdf-points-top-left",
                    "x": x1,
                    "y": y1,
                    "width": x2 - x1,
                    "height": y2 - y1,
                },
                "sha256": sha256(destination),
            }
        )

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf8",
    )
    print(f"circ3-step3-figures: extracted {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
