from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "gu-so8-2018-ntc"
EVIDENCE_RENDER_DIR = ROOT / "evidence" / SOURCE / "renders"
FIGURE_DIR = ROOT / "corpus" / "assets" / "figures" / "ntc2018"


FIGURES = {
    "fig4.3.5.png": (127, "82,195,380,100"),
    "fig4.3.6.png": (127, "82,575,440,100"),
    "fig4.3.7.png": (129, "82,460,440,83"),
    "fig4.3.8.png": (130, "82,88,440,200"),
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
