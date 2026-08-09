from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "gu-so8-2018-ntc"
EVIDENCE_RENDER_DIR = ROOT / "evidence" / SOURCE / "renders"
FIGURE_DIR = ROOT / "corpus" / "assets" / "figures" / "ntc2018"


FIGURES = {
    "fig4.3.9.png": (133, "82,198,440,120"),
    "fig4.3.10.png": (133, "82,492,440,76"),
    "fig4.3.11.png": (134, "82,110,440,70"),
    "fig4.3.12.png": (134, "82,500,440,105"),
}


def render(page: int, region: str) -> Path:
    command = [
        "npm.cmd", "run", "render:evidence", "--",
        "--source", SOURCE, "--page", str(page), "--scale", "3", "--region", region,
    ]
    subprocess.run(command, cwd=ROOT, check=True)
    x, y, width, height = region.split(",")
    return EVIDENCE_RENDER_DIR / f"page-{page:04d}-x{x}-y{y}-w{width}-h{height}@3x.png"


def main() -> None:
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    for filename, (page, region) in FIGURES.items():
        source = render(page, region)
        target = FIGURE_DIR / filename
        shutil.copyfile(source, target)
        print(f"Copiata {source} -> {target}")


if __name__ == "__main__":
    main()
