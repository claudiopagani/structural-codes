from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SOURCE = "gu-so8-2018-ntc"
RENDER_DIR = ROOT / "evidence" / SOURCE / "renders"
FIGURE_DIR = ROOT / "corpus" / "assets" / "figures" / "ntc2018"
MANIFEST_PATH = ROOT / "corpus" / "assets" / "ntc2018" / "core-figure-placeholders.json"
UNITS_DIR = ROOT / "corpus" / "units" / "ntc2018"
PROFILE = "core-editorial-profile-0.1.1"


FIGURES = {
    "3.3.1": {
        "unit": "3.3.1",
        "page": 57,
        "region": (70, 98, 305, 178),
        "filename": "fig3.3.1.png",
        "alt": "Mappa delle nove zone del vento in cui è suddiviso il territorio italiano.",
    },
    "3.3.2": {
        "unit": "3.3.7",
        "page": 59,
        "region": (65, 350, 385, 280),
        "filename": "fig3.3.2.png",
        "alt": "Schemi per l'assegnazione delle categorie di esposizione nelle zone del vento 1-9.",
    },
    "3.3.3": {
        "unit": "3.3.7",
        "page": 60,
        "region": (70, 90, 350, 185),
        "filename": "fig3.3.3.png",
        "alt": "Grafico del coefficiente di esposizione in funzione dell'altezza per le categorie I-V.",
    },
    "3.4.1": {
        "unit": "3.4.2",
        "page": 61,
        "region": (75, 385, 370, 345),
        "filename": "fig3.4.1.png",
        "alt": "Mappa delle tre zone italiane di carico della neve al suolo.",
    },
    "3.4.2": {
        "unit": "3.4.3.2",
        "page": 63,
        "region": (79, 186, 270, 82),
        "filename": "fig3.4.2.png",
        "alt": "Condizione di carico della neve per una copertura ad una falda.",
    },
    "3.4.3": {
        "unit": "3.4.3.3",
        "page": 63,
        "region": (79, 315, 325, 115),
        "filename": "fig3.4.3.png",
        "alt": "Tre condizioni alternative di carico della neve per una copertura a due falde.",
    },
    "3.5.1": {
        "unit": "3.5.2",
        "page": 64,
        "region": (78, 242, 310, 210),
        "filename": "fig3.5.1.png",
        "alt": "Mappa delle quattro zone italiane della temperatura dell'aria esterna.",
    },
    "3.5.2": {
        "unit": "3.5.4",
        "page": 65,
        "region": (78, 280, 330, 155),
        "filename": "fig3.5.2.png",
        "alt": "Andamento della temperatura attraverso materiale isolante ed elemento strutturale.",
    },
}


def region_string(region: tuple[int, int, int, int]) -> str:
    return ",".join(str(value) for value in region)


def region_record(region: tuple[int, int, int, int]) -> dict[str, object]:
    x, y, width, height = region
    return {
        "coordinateSystem": "pdf-points-top-left",
        "x": x,
        "y": y,
        "width": width,
        "height": height,
    }


def render(page: int, region: tuple[int, int, int, int]) -> Path:
    region_arg = region_string(region)
    subprocess.run(
        [
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
            region_arg,
        ],
        cwd=ROOT,
        check=True,
    )
    x, y, width, height = region
    return RENDER_DIR / f"page-{page:04d}-x{x}-y{y}-w{width}-h{height}@3x.png"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def update_unit(number: str, figure_ids: set[str]) -> None:
    path = UNITS_DIR / f"{number}.json"
    unit = json.loads(path.read_text(encoding="utf-8"))
    for block in unit["blocks"]:
        asset_id = block.get("assetId", "")
        if asset_id not in figure_ids:
            continue
        official_number = asset_id.rsplit(":", 1)[-1]
        definition = FIGURES[official_number]
        evidence = block["evidence"]
        evidence["region"] = region_record(definition["region"])
        evidence["extraction"] = {
            "method": "manual-transcription",
            "tool": "poppler-pdf-crop",
            "toolVersion": PROFILE,
        }
        evidence["transformations"] = [{
            "operation": "manual-correction",
            "ruleVersion": PROFILE,
            "note": "Ritaglio ad alta risoluzione ricavato dalla figura completa e dalla didascalia nella fonte ufficiale.",
        }]
    path.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    FIGURE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest_by_id = {figure["officialNumber"]: figure for figure in manifest["figures"]}
    figure_ids_by_unit: dict[str, set[str]] = {}

    for official_number, definition in FIGURES.items():
        rendered = render(definition["page"], definition["region"])
        target = FIGURE_DIR / definition["filename"]
        shutil.copyfile(rendered, target)

        figure = manifest_by_id[official_number]
        figure["alt"] = definition["alt"]
        figure["imagePath"] = f"figures/ntc2018/{definition['filename']}"
        figure["region"] = region_record(definition["region"])
        figure["sha256"] = sha256(target)

        figure_ids_by_unit.setdefault(definition["unit"], set()).add(figure["id"])
        print(f"{official_number}: {rendered} -> {target}")

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for unit_number, figure_ids in figure_ids_by_unit.items():
        update_unit(unit_number, figure_ids)


if __name__ == "__main__":
    main()
