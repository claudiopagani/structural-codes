from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "ntc2018"
OUTPUT.mkdir(parents=True, exist_ok=True)

# Regions are PDF points, top-left origin. They include the complete official
# drawing and its caption, without the surrounding running text.
FIGURES = {
    "fig5.1.4.png": (162, 170, 490, 260, 145),
    "fig5.1.5.png": (164, 150, 70, 300, 150),
    "fig5.2.1.png": (168, 125, 575, 350, 105),
    "fig5.2.2.png": (169, 135, 240, 350, 50),
    "fig5.2.3.png": (169, 100, 535, 320, 90),
    "fig5.2.4.png": (170, 80, 75, 430, 125),
    "fig5.2.5.png": (170, 45, 315, 500, 125),
    "fig5.2.6.png": (170, 45, 500, 500, 150),
    "fig5.2.7.png": (171, 70, 315, 460, 145),
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


with tempfile.TemporaryDirectory(prefix="ntc5-step2-figures-") as temp_dir:
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
        box = (
            round(x * scale),
            round(y * scale),
            round((x + width) * scale),
            round((y + height) * scale),
        )
        image.crop(box).save(OUTPUT / filename, format="PNG", optimize=True)
        print(f"{OUTPUT / filename}: {box}")
