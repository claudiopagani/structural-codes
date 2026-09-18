from pathlib import Path
import shutil
import subprocess
import tempfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "ntc2018"
OUTPUT.mkdir(parents=True, exist_ok=True)

# Regions are PDF points with a top-left origin. Each crop is confined to the
# corresponding source-table cell and excludes borders and surrounding prose.
IMAGES = {
    **{f"tab5.1.vii-vehicle-{index}.png": (163, *region) for index, region in enumerate([
        (100, 135, 80, 32), (100, 177, 85, 37), (86, 220, 100, 42), (86, 270, 100, 38), (78, 312, 115, 42)
    ], start=1)},
    **{f"tab5.1.viii-vehicle-{index}.png": (164, *region) for index, region in enumerate([
        (98, 285, 60, 32), (95, 333, 70, 35), (88, 385, 80, 45), (86, 445, 80, 40), (80, 505, 90, 45)
    ], start=1)},
    "tab5.1.ix-type-a.png": (165, 155, 128, 210, 78),
    "tab5.1.ix-type-b.png": (165, 155, 208, 210, 85),
    "tab5.1.ix-type-c.png": (165, 155, 298, 210, 75),
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


with tempfile.TemporaryDirectory(prefix="ntc5-table-images-") as temp_dir:
    temp = Path(temp_dir)
    rendered = {}
    for page in sorted({spec[0] for spec in IMAGES.values()}):
        prefix = temp / f"page-{page}"
        subprocess.run([command("pdftoppm.exe"), "-png", "-r", "300", "-f", str(page), "-l", str(page), "-singlefile", str(PDF), str(prefix)], check=True, stdout=subprocess.DEVNULL)
        rendered[page] = Image.open(f"{prefix}.png")
    scale = 300 / 72
    for filename, (page, x, y, width, height) in IMAGES.items():
        box = (round(x * scale), round(y * scale), round((x + width) * scale), round((y + height) * scale))
        rendered[page].crop(box).save(OUTPUT / filename, format="PNG", optimize=True)
        print(f"{OUTPUT / filename}: {box}")
