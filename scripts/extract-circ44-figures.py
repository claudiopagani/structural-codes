"""Estrae la figura ufficiale della Circolare 7/2019, § C4.4."""

from __future__ import annotations

import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
OUTPUT = REPO / "corpus" / "assets" / "figures" / "circ2019" / "figc4.4.1.png"
PDFTOPPM = Path(
    r"C:\Users\pagan\.cache\codex-runtimes\codex-primary-runtime"
    r"\dependencies\native\poppler\Library\bin\pdftoppm.exe"
)

# Coordinate PDF points, top-left. Include the complete drawing and caption,
# excluding the page header and surrounding prose.
PAGE = 157
BBOX = (135, 85, 465, 182)
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
    print(f"circ44-figures: {OUTPUT}")


if __name__ == "__main__":
    main()
