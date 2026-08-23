"""Extract the ten figures of Circolare 2019 C3, editorial step 1."""

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
    "C3.2.1a": {
        "unit": "c3.2",
        "page": 47,
        "bbox": (128, 340, 470, 456),
        "caption": (
            "Figura C3.2.1a – Variabilità di ag con TR: andamento medio sul "
            "territorio nazionale ed intervallo di confidenza al 95%"
        ),
    },
    "C3.2.1b": {
        "unit": "c3.2",
        "page": 47,
        "bbox": (128, 458, 470, 585),
        "caption": (
            "Figura C3.2.1b – Variabilità di Fo con TR: andamento medio sul "
            "territorio nazionale ed intervallo di confidenza al 95%"
        ),
    },
    "C3.2.1c": {
        "unit": "c3.2",
        "page": 47,
        "bbox": (128, 586, 470, 718),
        "caption": (
            "Figura C3.2.1c – Variabilità di TC* con TR: andamento medio sul "
            "territorio nazionale ed intervallo di confidenza al 95%"
        ),
    },
    "C3.2.2": {
        "unit": "c3.2.1",
        "page": 49,
        "bbox": (174, 278, 422, 468),
        "caption": "Figura C3.2.2 – Variazione di R con CU e PVR",
    },
    "C3.2.3": {
        "unit": "c3.2.3",
        "page": 52,
        "bbox": (155, 95, 440, 268),
        "caption": (
            "Figura C3.2.3 – Andamento del coefficiente SS per le componenti "
            "orizzontali dell’azione sismica"
        ),
    },
    "C3.2.4": {
        "unit": "c3.2.3",
        "page": 52,
        "bbox": (170, 430, 432, 625),
        "caption": "Figura C3.2.4 – Andamento del coefficiente CC",
    },
    "C3.3.1": {
        "unit": "c3.3.2",
        "page": 55,
        "bbox": (144, 88, 452, 252),
        "caption": (
            "Figura C3.3.1 – Valori del coefficiente αR in funzione del periodo "
            "di ritorno TR (asse in scala logaritmica)"
        ),
    },
    "C3.3.2": {
        "unit": "c3.3.8.1.1",
        "page": 56,
        "bbox": (142, 250, 455, 405),
        "caption": (
            "Figura C3.3.2 – a) Parametri caratteristici di edifici a pianta "
            "rettangolare; b) Edifici a pianta rettangolare: cpe per facce "
            "sopravento, sottovento e laterali"
        ),
    },
    "C3.3.3": {
        "unit": "c3.3.8.1.1",
        "page": 56,
        "bbox": (80, 490, 520, 675),
        "caption": (
            "Figura C3.3.3 – a) Schema planimetrico di riferimento; "
            "b) Suddivisione delle pareti verticali di edificio a pianta "
            "rettangolare in zone di uguale pressione (prospetti laterali)"
        ),
    },
    "C3.3.4": {
        "unit": "c3.3.8.1.1.1",
        "page": 57,
        "bbox": (160, 414, 438, 590),
        "caption": "Figure C3.3.4 – Quote di riferimento negli edifici bassi ed alti",
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
    print(f"circ3-step1-figures: extracted {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
