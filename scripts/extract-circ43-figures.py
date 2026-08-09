from pathlib import Path
import hashlib
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "circ2019"
OUTPUT.mkdir(parents=True, exist_ok=True)


# Regioni verificate sui render a scala 3; includono la figura e la didascalia
# quando questa appartiene visivamente all'asset.
FIGURES = {
    "figc4.3.1.png": (148, 140, 198, 330, 92),
    "figc4.3.2.png": (148, 140, 395, 330, 87),
    "figc4.3.3.png": (148, 130, 580, 350, 127),
    "figc4.3.4.png": (149, 150, 210, 350, 60),
    "figc4.3.5.png": (149, 110, 300, 420, 195),
    "figc4.3.6.png": (151, 145, 400, 330, 168),
    "figc4.3.7.png": (152, 140, 345, 340, 85),
    "figc4.3.8.png": (153, 75, 386, 455, 118),
    "figc4.3.9.png": (154, 70, 100, 455, 150),
}


for filename, (page, x, y, width, height) in FIGURES.items():
    region = f"{x},{y},{width},{height}"
    subprocess.run(
        [
            "npm.cmd",
            "run",
            "render:evidence",
            "--",
            "--source",
            "circ-7-2019",
            "--page",
            str(page),
            "--region",
            region,
            "--scale",
            "3",
        ],
        cwd=ROOT,
        check=True,
    )
    rendered = (
        ROOT
        / "evidence"
        / "circ-7-2019"
        / "renders"
        / f"page-{page:04d}-x{x}-y{y}-w{width}-h{height}@3x.png"
    )
    destination = OUTPUT / filename
    shutil.copyfile(rendered, destination)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    print(f"{destination}: {digest}")
