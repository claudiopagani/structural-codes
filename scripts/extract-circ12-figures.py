"""Extract Circolare 2019 Figure C2.1 from the official PDF."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
MANIFEST = REPO / "corpus" / "assets" / "circ2019" / "core-figure-placeholders.json"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "circ2019"
PDFTOPPM = Path(
    r"C:\Users\pagan\.cache\codex-runtimes\codex-primary-runtime"
    r"\dependencies\native\poppler\Library\bin\pdftoppm.exe"
)
RESOLUTION = 300
SCALE = RESOLUTION / 72

NUMBER = "C2.1"
PAGE = 42
BBOX = (105, 355, 490, 520)
CAPTION = (
    "Figura C2.1 – Evoluzione dell’affidabilità strutturale e del periodo "
    "di vita nominale in funzione delle strategie d’intervento"
)


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
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> None:
    if not PDFTOPPM.exists():
        raise FileNotFoundError(f"pdftoppm non trovato: {PDFTOPPM}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    destination = OUTPUT_DIR / "figc2.1.png"
    render_crop(PAGE, BBOX, destination)

    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    manifest["figures"] = [
        figure
        for figure in manifest["figures"]
        if figure.get("officialNumber") != NUMBER
    ]
    x1, y1, x2, y2 = BBOX
    manifest["figures"].append(
        {
            "id": "urn:structural-codes:it:asset:figure:circ2019:c2.1",
            "unitId": "urn:structural-codes:it:unit:circ2019:c2.4.1",
            "officialNumber": NUMBER,
            "pdfPage": PAGE,
            "caption": CAPTION,
            "alt": CAPTION,
            "imagePath": "figures/circ2019/figc2.1.png",
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
    print(f"circ12-figures: extracted {NUMBER} -> {destination}")


if __name__ == "__main__":
    main()
