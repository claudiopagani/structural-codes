from pathlib import Path
import hashlib
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "corpus" / "assets" / "figures" / "circ2019"
OUTPUT.mkdir(parents=True, exist_ok=True)

PAGE = 147
X, Y, WIDTH, HEIGHT = 75, 538, 130, 122
FILENAME = "table-c4.3.i-schemes.png"

subprocess.run(
    [
        "npm.cmd",
        "run",
        "render:evidence",
        "--",
        "--source",
        "circ-7-2019",
        "--page",
        str(PAGE),
        "--region",
        f"{X},{Y},{WIDTH},{HEIGHT}",
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
    / f"page-{PAGE:04d}-x{X}-y{Y}-w{WIDTH}-h{HEIGHT}@3x.png"
)
destination = OUTPUT / FILENAME
shutil.copyfile(rendered, destination)
digest = hashlib.sha256(destination.read_bytes()).hexdigest()
print(f"{destination}: {digest}")
