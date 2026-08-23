"""Extract the official raster crops for Circolare 7/2019 C7.10."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from lib.poppler import resolve_pdftoppm

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
MANIFEST = ROOT / "corpus" / "assets" / "circ2019" / "7.10.json"
OUT = ROOT / "corpus" / "assets" / "figures" / "circ2019"
PDFTOPPM = resolve_pdftoppm()
RESOLUTION = 300
SCALE = RESOLUTION / 72


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    OUT.mkdir(parents=True, exist_ok=True)
    for figure in manifest["figures"]:
        region = figure["region"]
        target = OUT / Path(figure["imagePath"]).name
        subprocess.run(
            [
                str(PDFTOPPM),
                "-f", str(figure["pdfPage"]), "-l", str(figure["pdfPage"]),
                "-r", str(RESOLUTION), "-png", "-singlefile",
                "-x", str(round(region["x"] * SCALE)),
                "-y", str(round(region["y"] * SCALE)),
                "-W", str(round(region["width"] * SCALE)),
                "-H", str(round(region["height"] * SCALE)),
                str(PDF), str(target.with_suffix("")),
            ],
            check=True,
        )
        figure["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"circ710-step1-figures: extracted {len(manifest['figures'])} figures")


if __name__ == "__main__":
    main()
