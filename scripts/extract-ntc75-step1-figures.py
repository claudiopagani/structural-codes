"""Extract official raster fragments of the page-broken NTC 7.5.1 figure."""

from __future__ import annotations

import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "ntc2018"
PDFTOPPM = Path(
    r"C:\Users\pagan\.cache\codex-runtimes\codex-primary-runtime"
    r"\dependencies\native\poppler\Library\bin\pdftoppm.exe"
)
RESOLUTION = 300
SCALE = RESOLUTION / 72

FIGMENTS = {
    "fig7.5.1-upper": {"page": 244, "bbox": (70, 390, 540, 740)},
    "fig7.5.1-lower": {"page": 245, "bbox": (70, 75, 540, 410)},
}


def render_crop(page: int, bbox: tuple[int, int, int, int], destination: Path) -> None:
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


def main() -> None:
    if not PDFTOPPM.exists():
        raise FileNotFoundError(f"pdftoppm non trovato: {PDFTOPPM}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stem, spec in FIGMENTS.items():
        render_crop(spec["page"], spec["bbox"], OUTPUT_DIR / f"{stem}.png")
    print(f"ntc75-step1-figures: extracted {len(FIGMENTS)} page fragments")


if __name__ == "__main__":
    main()
