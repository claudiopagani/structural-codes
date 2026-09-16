from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "evidence" / "gu-so8-2018-ntc" / "renders"
DESTINATION = ROOT / "corpus" / "assets" / "figures" / "ntc2018"

# Regions are PDF points, measured on the official render of page 108. Each
# crop contains exactly one diagram cell, including the psi label where it is
# printed in the source table.
FIGURES = {
    "table4.2.x-diagram-1.png": (108, 89, 407, 101, 21),
    "table4.2.x-diagram-2.png": (108, 89, 431, 101, 21),
    "table4.2.x-diagram-3.png": (108, 89, 454, 101, 15),
    "table4.2.x-diagram-4.png": (108, 89, 474, 101, 10),
    "table4.2.x-diagram-5.png": (108, 89, 495, 101, 15),
    "table4.2.x-diagram-6.png": (108, 89, 512, 101, 15),
    "table4.2.x-diagram-7.png": (108, 89, 533, 101, 14),
    "table4.2.x-diagram-8.png": (108, 89, 554, 101, 16),
}


def main():
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for filename, (page, x, y, width, height) in FIGURES.items():
        command = [
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
        ]
        subprocess.run(command, cwd=ROOT, check=True)
        rendered = EVIDENCE / f"page-{page:04d}-x{x:g}-y{y:g}-w{width:g}-h{height:g}@3x.png"
        if not rendered.exists():
            raise FileNotFoundError(rendered)
        shutil.copyfile(rendered, DESTINATION / filename)
        print(f"copied {filename}")


if __name__ == "__main__":
    main()
