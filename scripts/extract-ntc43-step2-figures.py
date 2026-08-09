from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "gu-so8-2018-ntc"
EVIDENCE_RENDER_DIR = ROOT / "evidence" / SOURCE / "renders"
FIGURE_DIR = ROOT / "corpus" / "assets" / "figures" / "ntc2018"


FIGURES = {
    "fig4.3.3.png": (124, "75,80,450,90"),
    "fig4.3.4a.png": (126, "82,135,440,64"),
    "fig4.3.4b.png": (126, "82,369,440,75"),
}


def render(page: int, region: str) -> Path:
    command = [
        "npm.cmd",
        "run",
        "render:evidence",
        "--",
        "--source",
        SOURCE,
        "--page",
        str(page),
        "--scale",
        "3",
        "--region",
        region,
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
