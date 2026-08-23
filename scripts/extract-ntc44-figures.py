"""Estrae la figura ufficiale NTC 2018 del § 4.4."""

from __future__ import annotations

import subprocess
from pathlib import Path

from lib.poppler import resolve_pdftoppm


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT = REPO / "corpus" / "assets" / "figures" / "ntc2018" / "fig4.4.1.png"
PDFTOPPM = resolve_pdftoppm()

# Coordinate PDF points, top-left. Include the complete drawing and its caption.
PAGE = 140
BBOX = (80, 160, 430, 282)
RESOLUTION = 300
SCALE = RESOLUTION / 72


def main() -> None:
    if not PDFTOPPM.exists():
        raise FileNotFoundError(f"pdftoppm non trovato: {PDFTOPPM}")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    x0, y0, x1, y1 = BBOX
    prefix = OUTPUT.with_suffix("")
    subprocess.run(
        [
            str(PDFTOPPM),
            "-f",
            str(PAGE),
            "-l",
            str(PAGE),
            "-r",
            str(RESOLUTION),
            "-png",
            "-singlefile",
            "-x",
            str(round(x0 * SCALE)),
            "-y",
            str(round(y0 * SCALE)),
            "-W",
            str(round((x1 - x0) * SCALE)),
            "-H",
            str(round((y1 - y0) * SCALE)),
            str(PDF),
            str(prefix),
        ],
        check=True,
    )
    print(f"ntc44-figures: {OUTPUT}")


if __name__ == "__main__":
    main()
