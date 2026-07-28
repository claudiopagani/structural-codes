"""Extract the two official NTC 2018 figures in editorial step 7.4/1."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
MANIFEST = REPO / "corpus" / "assets" / "ntc2018" / "7.4-step1.json"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "ntc2018"
PDFTOPPM = Path(
    r"C:\Users\pagan\.cache\codex-runtimes\codex-primary-runtime"
    r"\dependencies\native\poppler\Library\bin\pdftoppm.exe"
)
RESOLUTION = 300
SCALE = RESOLUTION / 72

FIGURES = {
    "7.4.1": {"page": 229, "bbox": (185, 392, 435, 540)},
    "7.4.2": {"page": 231, "bbox": (185, 88, 450, 244)},
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
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    by_number = {
        figure["officialNumber"]: figure for figure in manifest["figures"]
    }
    for number, spec in FIGURES.items():
        destination = OUTPUT_DIR / f"fig{number}.png"
        render_crop(spec["page"], spec["bbox"], destination)
        x1, y1, x2, y2 = spec["bbox"]
        figure = by_number[number]
        figure["region"] = {
            "coordinateSystem": "pdf-points-top-left",
            "x": x1,
            "y": y1,
            "width": x2 - x1,
            "height": y2 - y1,
        }
        figure["sha256"] = sha256(destination)
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf8",
    )
    print(f"ntc74-step1-figures: extracted {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
