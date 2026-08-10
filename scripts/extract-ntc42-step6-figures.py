from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "ntc2018"
OUTPUT.mkdir(parents=True, exist_ok=True)

FIGURES = {
    "fig4.2.6.png": (117, 75, 238, 330, 65),
    "fig4.2.7.png": (117, 75, 505, 320, 100),
}

for filename, (page, x, y, width, height) in FIGURES.items():
    subprocess.run(
        [
            "npm.cmd",
            "run",
            "render:evidence",
            "--",
            "--source",
            "gu-so8-2018-ntc",
            "--page",
            str(page),
            "--region",
            f"{x},{y},{width},{height}",
            "--scale",
            "3",
        ],
        cwd=ROOT,
        check=True,
    )
    rendered = ROOT / "evidence" / "gu-so8-2018-ntc" / "renders" / f"page-{page:04d}-x{x}-y{y}-w{width}-h{height}@3x.png"
    shutil.copyfile(rendered, OUTPUT / filename)
    print(f"{OUTPUT / filename}: {rendered}")
