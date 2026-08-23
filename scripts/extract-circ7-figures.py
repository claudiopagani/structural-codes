"""Extract official Circ. 7 figures used by the C7.2/C7.3 corpus steps."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from lib.poppler import resolve_pdftoppm

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
MANIFESTS = [
    ROOT / "corpus" / "assets" / "circ2019" / "7.2.json",
    ROOT / "corpus" / "assets" / "circ2019" / "7.3.json",
]
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "circ2019"
PDFTOPPM = resolve_pdftoppm()
RESOLUTION = 300
SCALE = RESOLUTION / 72


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    count = 0
    for manifest_path in MANIFESTS:
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        for figure in manifest["figures"]:
            region = figure["region"]
            target = OUTPUT / Path(figure["imagePath"]).name
            subprocess.run(
                [
                    str(PDFTOPPM),
                    "-f",
                    str(figure["pdfPage"]),
                    "-l",
                    str(figure["pdfPage"]),
                    "-r",
                    str(RESOLUTION),
                    "-png",
                    "-singlefile",
                    "-x",
                    str(round(region["x"] * SCALE)),
                    "-y",
                    str(round(region["y"] * SCALE)),
                    "-W",
                    str(round(region["width"] * SCALE)),
                    "-H",
                    str(round(region["height"] * SCALE)),
                    str(PDF),
                    str(target.with_suffix("")),
                ],
                check=True,
            )
            figure["sha256"] = sha256(target)
            count += 1
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf8",
        )
    print(f"circ7-figures: extracted {count} figures")


if __name__ == "__main__":
    main()
