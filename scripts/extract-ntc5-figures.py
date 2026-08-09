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
    "fig5.1.1.png": (156, 75, 140, 340, 95),
    "fig5.1.2.png": (157, 65, 345, 465, 320),
    "fig5.1.3.a.png": (158, 75, 460, 260, 105),
    "fig5.1.3.b.png": (158, 330, 465, 205, 100),
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


with tempfile.TemporaryDirectory(prefix="ntc5-figures-") as temp_dir:
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
