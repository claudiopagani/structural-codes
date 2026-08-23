"""Extract official raster crops for NTC 7.6 figures."""

from __future__ import annotations

import subprocess
from pathlib import Path

from lib.poppler import resolve_pdftoppm


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "ntc2018"
PDFTOPPM = resolve_pdftoppm()
RESOLUTION = 300
SCALE = RESOLUTION / 72

FIGURES = {
    "fig7.6.1": {"page": 254, "bbox": (230, 370, 410, 520)},
    "fig7.6.2": {"page": 256, "bbox": (80, 437, 460, 545)},
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
    for stem, spec in FIGURES.items():
        render_crop(spec["page"], spec["bbox"], OUTPUT_DIR / f"{stem}.png")
    print(f"ntc76-step1-figures: extracted {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
