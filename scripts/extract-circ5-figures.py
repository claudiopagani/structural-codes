from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "circ2019"
OUTPUT.mkdir(parents=True, exist_ok=True)

# Regions are PDF points, top-left origin. They include the complete official
# drawing and caption without headers, footers, or surrounding prose.
FIGURES = {
    "figc5.1.1.png": (171, 160, 90, 280, 145),
    "figc5.1.2.png": (173, 150, 480, 300, 150),
    "figc5.2.1.png": (175, 100, 80, 400, 190),
    "figc5.2.2.png": (175, 45, 270, 500, 205),
    "figc5.2.3.png": (175, 45, 480, 520, 240),
}


def command(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    if name == "pdftoppm.exe":
        override = (
            Path.home()
            / ".cache"
            / "codex-runtimes"
            / "codex-primary-runtime"
            / "dependencies"
            / "native"
            / "poppler"
            / "Library"
            / "bin"
            / name
        )
    else:
        override = (
            Path.home()
            / ".cache"
            / "codex-runtimes"
            / "codex-primary-runtime"
            / "dependencies"
            / "bin"
            / "override"
            / name
        )
    if override.exists():
        return str(override)
    raise FileNotFoundError(name)


with tempfile.TemporaryDirectory(prefix="circ5-figures-") as temp_dir:
    temp = Path(temp_dir)
    for filename, (page, x, y, width, height) in FIGURES.items():
        prefix = temp / f"page-{page}"
        subprocess.run(
            [
                command("pdftoppm.exe"),
                "-png",
                "-r",
                "300",
                "-f",
                str(page),
                "-l",
                str(page),
                "-singlefile",
                str(PDF),
                str(prefix),
            ],
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
