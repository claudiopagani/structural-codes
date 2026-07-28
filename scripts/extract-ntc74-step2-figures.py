"""Extract official NTC 2018 figures 7.4.3–7.4.6."""
from __future__ import annotations
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf"
MANIFEST = ROOT / "corpus/assets/ntc2018/7.4-step2.json"
OUT = ROOT / "corpus/assets/figures/ntc2018"
PDFTOPPM = Path(r"C:\Users\pagan\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe")
SCALE = 300 / 72

def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    OUT.mkdir(parents=True, exist_ok=True)
    for figure in manifest["figures"]:
        r = figure["region"]
        target = OUT / Path(figure["imagePath"]).name
        subprocess.run([
            str(PDFTOPPM), "-f", str(figure["pdfPage"]), "-l", str(figure["pdfPage"]),
            "-r", "300", "-png", "-singlefile",
            "-x", str(round(r["x"] * SCALE)), "-y", str(round(r["y"] * SCALE)),
            "-W", str(round(r["width"] * SCALE)), "-H", str(round(r["height"] * SCALE)),
            str(PDF), str(target.with_suffix("")),
        ], check=True)
        figure["sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"ntc74-step2-figures: extracted {len(manifest['figures'])} figures")

if __name__ == "__main__":
    main()
