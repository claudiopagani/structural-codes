from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf"
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "ntc2018"
OUTPUT.mkdir(parents=True, exist_ok=True)

FIGURES = {
    "fig4.3.1.png": (121, 82.954, 600, 260, 120),
    "fig4.3.2.png": (122, 82.954, 200, 440, 166),
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


for filename, (page, x, y, width, height) in FIGURES.items():
    region = f"{x},{y},{width},{height}"
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
        / "gu-so8-2018-ntc"
        / "renders"
        / f"page-{page:04d}-x{x}-y{y}-w{width}-h{height}@3x.png"
    )
    shutil.copyfile(rendered, OUTPUT / filename)
    print(f"{OUTPUT / filename}: {rendered}")
