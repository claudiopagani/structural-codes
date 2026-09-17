from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "gu-so8-2018-ntc"
EVIDENCE_RENDER_DIR = ROOT / "evidence" / SOURCE / "renders"
FIGURE_DIR = ROOT / "corpus" / "assets" / "figures" / "ntc2018"


TABLE_CELL_IMAGES = {
    "tab4.3.iii-a.png": (131, "80,378,94,53"),
    "tab4.3.iii-b.png": (131, "80,449,94,51"),
    "tab4.3.iii-c.png": (131, "80,513,94,68"),
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
    for filename, (page, region) in TABLE_CELL_IMAGES.items():
        source = render(page, region)
        target = FIGURE_DIR / filename
        shutil.copyfile(source, target)
        print(f"Copiata {source} -> {target}")


if __name__ == "__main__":
    main()
