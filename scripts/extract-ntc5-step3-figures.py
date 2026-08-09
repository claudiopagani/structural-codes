from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "ntc2018"
OUTPUT.mkdir(parents=True, exist_ok=True)

FIGURES = {
    "fig5.2.8.png": (177, 105, 140, 390, 170),
    "fig5.2.9.png": (178, 105, 75, 390, 235),
    "fig5.2.10.png": (178, 105, 325, 390, 195),
    "fig5.2.11.png": (179, 140, 70, 320, 205),
    "fig5.2.12.png": (180, 165, 235, 330, 100),
    "fig5.2.13.png": (180, 165, 390, 330, 115),
}


def command(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    if name == "pdftoppm.exe":
        override = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "native" / "poppler" / "Library" / "bin" / name
    else:
        override = Path.home() / ".cache" / "codex-runtimes" / "codex-primary-runtime" / "dependencies" / "bin" / "override" / name
    if override.exists():
        return str(override)
    raise FileNotFoundError(name)


with tempfile.TemporaryDirectory(prefix="ntc5-step3-figures-") as temp_dir:
    temp = Path(temp_dir)
    for filename, (page, x, y, width, height) in FIGURES.items():
        prefix = temp / f"page-{page}"
        subprocess.run(
            [command("pdftoppm.exe"), "-png", "-r", "300", "-f", str(page), "-l", str(page), "-singlefile", str(PDF), str(prefix)],
            check=True,
            stdout=subprocess.DEVNULL,
        )
        image = Image.open(f"{prefix}.png")
        scale = 300 / 72
        box = (round(x * scale), round(y * scale), round((x + width) * scale), round((y + height) * scale))
        image.crop(box).save(OUTPUT / filename, format="PNG", optimize=True)
        print(f"{OUTPUT / filename}: {box}")
