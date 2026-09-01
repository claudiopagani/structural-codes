"""Remove printed figure captions from the canonical raster crops.

The figure caption remains in the structured asset metadata and is rendered by
the viewer as text. This script uses the official PDF text geometry only to
locate the caption belonging to each official figure number; it never guesses
an arbitrary bottom offset.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree

import numpy as np
from PIL import Image

from lib.poppler import resolve_pdftoppm


ROOT = Path(__file__).resolve().parents[1]

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
FIGURE_MANIFEST_DIRS = {
    "ntc2018": ROOT / "corpus" / "assets" / "ntc2018",
    "circ2019": ROOT / "corpus" / "assets" / "circ2019",
}
PDFS = {
    "ntc2018": ROOT / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf",
    "circ2019": ROOT / "raw-sources" / "circ2019" / "circolare-7-2019.pdf",
}
UNITS_DIRS = {
    "ntc2018": ROOT / "corpus" / "units" / "ntc2018",
    "circ2019": ROOT / "corpus" / "units" / "circ2019",
}
UNIT_FILENAME_OVERRIDES = {
    # The legacy manifest points to the following unit, while the actual
    # figure-ref is kept in the immediately following unit in the corpus.
    "urn:structural-codes:it:asset:figure:circ2019:4.3.7": "c4.3.4.3.6.json",
}
PDFTOTEXT = "pdftotext.exe"
PROFILE = "figure-caption-crop-0.1.0"
CAPTION_GAP = 2.0

# These assets are reconstructed from more than one raster crop. Their
# manifest region describes the first PDF crop, while their PNG contains the
# continuation as well; the region must therefore remain unchanged when the
# PNG is shortened.
COMPOSITE_IDS = {
    "urn:structural-codes:it:asset:figure:circ2019:c4.1.10",
    "urn:structural-codes:it:asset:figure:circ2019:c4.1.13",
}

# The following captions are rasterized inside the source image and cannot be
# located through PDF text geometry. Their cut rows were selected by visual
# comparison with the official render; keeping them here makes the correction
# reproducible and prevents a heuristic from cutting figure content.
PIXEL_HEIGHT_OVERRIDES = {
    "urn:structural-codes:it:asset:figure:circ2019:c4.1.10": 897,
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.2": 446,
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.3": 476,
    "urn:structural-codes:it:asset:figure:circ2019:4.3.7": 223,
}

# One pre-existing manifest entry was written with the coordinates of a
# different figure order than the generator that produced its PNG. Repair it
# from the generator's verified bbox before calculating the new crop.
REGION_OVERRIDES = {
    "urn:structural-codes:it:asset:figure:circ2019:c5.1.1": {
        "coordinateSystem": "pdf-points-top-left",
        "x": 160,
        "y": 90,
        "width": 280,
        "height": 145,
    },
}

# The upper part of NTC Fig. 7.5.1 contains panel labels (b1-b3), not the
# printed figure caption. The actual caption is present in the lower asset.
NO_RASTER_CAPTION_IDS = {
    "urn:structural-codes:it:asset:figure:ntc2018:7.5.1:upper",
    # These crops end at the drawing or panel content; the printed caption is
    # outside the canonical raster region and is already structured in the
    # manifest/unit data. They must not be mistaken for a caption band.
    "urn:structural-codes:it:asset:figure:circ2019:c11.3.2.10.4.a",
    "urn:structural-codes:it:asset:figure:circ2019:c11.3.2.10.4.b",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.26",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.6",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.7",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.8",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.9",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.10",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.11",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.12",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.13",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.14",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.15",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.16",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.17",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.18",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.19",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.20",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.21",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.22",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.23",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.25",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.24",
}


@dataclass(frozen=True)
class TextLine:
    text: str
    x_min: float
    y_min: float
    x_max: float
    y_max: float


@dataclass(frozen=True)
class CropPlan:
    manifest_path: Path
    unit_path: Path
    figure_id: str
    official_number: str
    image_path: Path
    old_region: dict[str, object]
    new_region: dict[str, object]
    caption_line: TextLine
    pixel_height: int
    image_width: int
    image_height: int


def normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).casefold()


def compact(value: str) -> str:
    return re.sub(r"\s+", "", normalize(value))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def manifest_paths(document: str | None) -> Iterable[Path]:
    directories = FIGURE_MANIFEST_DIRS.values() if document is None else [FIGURE_MANIFEST_DIRS[document]]
    for directory in directories:
        yield from sorted(directory.glob("*.json"))


def load_figures(document: str | None) -> list[tuple[Path, dict, dict]]:
    result: list[tuple[Path, dict, dict]] = []
    for path in manifest_paths(document):
        manifest = json.loads(path.read_text(encoding="utf-8"))
        for figure in manifest.get("figures", []):
            override = REGION_OVERRIDES.get(figure["id"])
            if override is not None:
                figure["region"] = dict(override)
            result.append((path, manifest, figure))
    return result


def parse_page_lines(pdf: Path, page: int) -> list[TextLine]:
    completed = subprocess.run(
        [PDFTOTEXT, "-f", str(page), "-l", str(page), "-bbox-layout", str(pdf), "-"],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    # Some official pages contain isolated control glyphs in the extracted
    # text (for example U+0003). They are not valid XML characters, but they
    # are irrelevant to figure-caption detection.
    xml_text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", completed.stdout)
    root = ElementTree.fromstring(xml_text)
    lines: list[TextLine] = []
    for line in root.iter():
        if line.tag.rsplit("}", 1)[-1] != "line":
            continue
        words = [word for word in line if word.tag.rsplit("}", 1)[-1] == "word" and word.text]
        text = " ".join(word.text or "" for word in words).strip()
        if not text:
            continue
        lines.append(
            TextLine(
                text=text,
                x_min=float(line.attrib["xMin"]),
                y_min=float(line.attrib["yMin"]),
                x_max=float(line.attrib["xMax"]),
                y_max=float(line.attrib["yMax"]),
            )
        )
    return lines


def caption_line(figure: dict, lines: list[TextLine]) -> TextLine | None:
    region = figure["region"]
    x_min = float(region["x"])
    y_min = float(region["y"])
    x_max = x_min + float(region["width"])
    y_max = y_min + float(region["height"])
    number = compact(str(figure["officialNumber"]))
    candidates = []
    for line in lines:
        if line.y_min < y_min - 3 or line.y_min > y_max + 30:
            continue
        if min(line.x_max, x_max) - max(line.x_min, x_min) <= 0:
            continue
        if number not in compact(line.text):
            continue
        if not re.search(r"(?:^|\s)(?:fig(?:ura)?\.?|figure)(?=\s|$)", line.text, re.IGNORECASE):
            continue
        candidates.append(line)
    return min(candidates, key=lambda line: (line.y_min, line.x_min), default=None)


def raster_caption_start(image_path: Path) -> int | None:
    """Find the isolated bottom caption band in an image-only PDF crop.

    Captions embedded in raster figure objects are not returned by
    ``pdftotext``. The detector deliberately only accepts a short, isolated
    band near the bottom; large connected drawing regions and panel labels
    are not accepted. A caller still needs to inspect the resulting crop.
    """
    with Image.open(image_path) as image:
        pixels = np.array(image.convert("L"))
    dark = pixels < 200
    row_fraction = dark.mean(axis=1)
    col_fraction = dark.mean(axis=0)
    # Remove the page/frame edges that otherwise connect the complete image
    # into one component (notably the framed C7.2 figures).
    dark[row_fraction > 0.65, :] = False
    dark[:, col_fraction > 0.65] = False
    has_dark = dark.any(axis=1)
    groups: list[tuple[int, int]] = []
    index = 0
    while index < len(has_dark):
        if not has_dark[index]:
            index += 1
            continue
        end = index
        while end + 1 < len(has_dark) and has_dark[end + 1]:
            end += 1
        groups.append((index, end))
        index = end + 1

    # Caption lines can be split into two raster bands by anti-aliasing or a
    # small inter-line gap. Merge only in the lower part of the crop.
    merged: list[tuple[int, int]] = []
    for start, end in groups:
        if merged and start - merged[-1][1] - 1 <= 12 and start > len(has_dark) * 0.55:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))

    height = len(has_dark)
    candidates = [
        (start, end)
        for start, end in merged
        if start > height * 0.60 and end - start + 1 <= 100
    ]
    return candidates[-1][0] if candidates else None


def parse_pages(value: str | None) -> tuple[int, int] | None:
    if value is None:
        return None
    match = re.fullmatch(r"(\d+)-(\d+)", value)
    if not match:
        raise ValueError("--pages deve avere il formato inizio-fine")
    start, end = (int(part) for part in match.groups())
    if end < start or end - start + 1 > 10:
        raise ValueError("uno step può coprire al massimo 10 pagine contigue")
    return start, end


def figure_in_scope(figure: dict, pages: tuple[int, int] | None) -> bool:
    if pages is None:
        return True
    return pages[0] <= int(figure["pdfPage"]) <= pages[1]


def unit_path_for_figure(figure: dict) -> Path:
    document = "circ2019" if ":circ2019:" in figure["id"] else "ntc2018"
    filename = UNIT_FILENAME_OVERRIDES.get(
        figure["id"], f"{figure['unitId'].rsplit(':', 1)[-1]}.json"
    )
    return UNITS_DIRS[document] / filename


def figure_already_processed(figure: dict) -> bool:
    """Return whether the unit already records this deterministic crop."""
    unit_path = unit_path_for_figure(figure)
    if not unit_path.exists():
        return False
    unit = json.loads(unit_path.read_text(encoding="utf-8"))
    for block in unit.get("blocks", []):
        if block.get("assetId") != figure["id"]:
            continue
        processed = any(
            item.get("ruleVersion") == PROFILE
            for item in block.get("evidence", {}).get("transformations", [])
        )
        if not processed:
            return False
        override = PIXEL_HEIGHT_OVERRIDES.get(figure["id"])
        if override is None:
            return True
        image_path = ROOT / "corpus" / "assets" / figure["imagePath"]
        with Image.open(image_path) as image:
            return image.height <= override
    return False


def make_plan(manifest_path: Path, figure: dict, lines_by_page: dict[int, list[TextLine]]) -> CropPlan | None:
    document = "circ2019" if ":circ2019:" in figure["id"] else "ntc2018"
    image_path = ROOT / "corpus" / "assets" / figure["imagePath"]
    old_region = dict(figure["region"])
    with Image.open(image_path) as image:
        image_width, image_height = image.size

    if figure["id"] in NO_RASTER_CAPTION_IDS:
        print(f"[SKIP] nessuna didascalia stampata in questo pannello: {figure['id']} p.{figure['pdfPage']}")
        return None

    pixel_override = PIXEL_HEIGHT_OVERRIDES.get(figure["id"])
    if pixel_override is not None:
        if pixel_override <= 0 or pixel_override >= image_height:
            print(f"[ISSUE] limite pixel crop non valido: {figure['id']} p.{figure['pdfPage']} pixel={pixel_override}")
            return None
        new_region = dict(old_region)
        if figure["id"] not in COMPOSITE_IDS:
            new_region["height"] = round(pixel_override * float(old_region["width"]) / image_width, 3)
        line = TextLine(
            text=str(figure["caption"]),
            x_min=float(old_region["x"]),
            y_min=float(old_region["y"]) + pixel_override * float(old_region["width"]) / image_width,
            x_max=float(old_region["x"]) + float(old_region["width"]),
            y_max=float(old_region["y"]) + pixel_override * float(old_region["width"]) / image_width,
        )
        print(f"[OVERRIDE] didascalia rasterizzata esclusa dal PNG: {figure['id']} p.{figure['pdfPage']}")
        unit_path = unit_path_for_figure(figure)
        return CropPlan(
            manifest_path=manifest_path,
            unit_path=unit_path,
            figure_id=figure["id"],
            official_number=figure["officialNumber"],
            image_path=image_path,
            old_region=old_region,
            new_region=new_region,
            caption_line=line,
            pixel_height=pixel_override,
            image_width=image_width,
            image_height=image_height,
        )

    line = caption_line(figure, lines_by_page[int(figure["pdfPage"])])
    old_y = float(old_region["y"])
    old_bottom = old_y + float(old_region["height"])
    # A caption can be extracted from the page but still fall below the
    # canonical raster region (the region may intentionally omit it). In
    # that case the text line is not evidence that this PNG contains the
    # caption; try the raster detector instead.
    if line is not None and not old_y < line.y_min - CAPTION_GAP < old_bottom:
        line = None
    raster_start: int | None = None
    if line is None:
        raster_start = raster_caption_start(image_path)
        if raster_start is not None:
            y_min = float(old_region["y"]) + raster_start * float(old_region["width"]) / image_width
            line = TextLine(
                text=str(figure["caption"]),
                x_min=float(old_region["x"]),
                y_min=y_min,
                x_max=float(old_region["x"]) + float(old_region["width"]),
                y_max=y_min,
            )
            print(f"[RASTER] didascalia localizzata nel PNG: {figure['id']} p.{figure['pdfPage']} y≈{round(y_min, 2)}")
    if line is None:
        print(f"[ISSUE] didascalia non localizzata: {figure['id']} p.{figure['pdfPage']}")
        return None

    new_bottom = line.y_min - CAPTION_GAP
    if raster_start is None and new_bottom <= float(old_region["y"]):
        print(f"[ISSUE] limite crop non valido: {figure['id']} p.{figure['pdfPage']}")
        return None

    # Use the horizontal scale of the existing PNG. This also handles legacy
    # crops whose stored height is a rounded or composite value.
    pixel_height = (
        round(raster_start - CAPTION_GAP * image_width / float(old_region["width"]))
        if raster_start is not None
        else round((new_bottom - float(old_region["y"])) * image_width / float(old_region["width"]))
    )
    if pixel_height <= 0 or pixel_height >= image_height:
        print(f"[ISSUE] limite pixel crop non valido: {figure['id']} p.{figure['pdfPage']} pixel={pixel_height}")
        return None
    new_region = dict(old_region)
    if figure["id"] not in COMPOSITE_IDS:
        new_region["height"] = round(pixel_height * float(old_region["width"]) / image_width, 3)
    unit_path = unit_path_for_figure(figure)
    return CropPlan(
        manifest_path=manifest_path,
        unit_path=unit_path,
        figure_id=figure["id"],
        official_number=figure["officialNumber"],
        image_path=image_path,
        old_region=old_region,
        new_region=new_region,
        caption_line=line,
        pixel_height=pixel_height,
        image_width=image_width,
        image_height=image_height,
    )


def same_region(left: dict, right: dict) -> bool:
    if not isinstance(left, dict) or not isinstance(right, dict):
        return False
    if any(key not in left or key not in right for key in ("x", "y", "width", "height")):
        return False
    return all(abs(float(left[key]) - float(right[key])) < 0.001 for key in ("x", "y", "width", "height"))


def update_units(plans: list[CropPlan]) -> int:
    by_unit: dict[Path, dict[str, CropPlan]] = {}
    for plan in plans:
        by_unit.setdefault(plan.unit_path, {})[plan.figure_id] = plan
    changed = 0
    note = "Didascalia esclusa dal crop raster; resta nel testo strutturato della figura."
    for unit_path, unit_plans in by_unit.items():
        unit = json.loads(unit_path.read_text(encoding="utf-8"))
        touched = False
        for block in unit.get("blocks", []):
            plan = unit_plans.get(block.get("assetId"))
            if plan is None or "evidence" not in block:
                continue
            evidence = block["evidence"]
            if same_region(evidence.get("region", {}), plan.old_region):
                evidence["region"] = plan.new_region
            transformations = evidence.setdefault("transformations", [])
            if not any(item.get("ruleVersion") == PROFILE for item in transformations):
                transformations.append({"operation": "manual-correction", "ruleVersion": PROFILE, "note": note})
            touched = True
        if touched:
            unit_path.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            changed += 1
    return changed


def apply_plans(plans: list[CropPlan], manifests: dict[Path, dict]) -> tuple[int, int]:
    changed_images = 0
    changed_manifests = set()
    for plan in plans:
        with Image.open(plan.image_path) as image:
            cropped = image.crop((0, 0, plan.image_width, plan.pixel_height))
            cropped.save(plan.image_path, "PNG", optimize=True)
        manifest = manifests[plan.manifest_path]
        for figure in manifest["figures"]:
            if figure["id"] != plan.figure_id:
                continue
            figure["region"] = plan.new_region
            figure["sha256"] = sha256(plan.image_path)
            break
        changed_images += 1
        changed_manifests.add(plan.manifest_path)
    for manifest_path in sorted(changed_manifests):
        manifest_path.write_text(json.dumps(manifests[manifest_path], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changed_images, len(changed_manifests)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--document", choices=sorted(FIGURE_MANIFEST_DIRS))
    parser.add_argument("--pages", help="intervallo chiuso di massimo 10 pagine, es. 57-65")
    parser.add_argument("--apply", action="store_true", help="scrive PNG, manifest e provenance")
    args = parser.parse_args()
    pages = parse_pages(args.pages)
    figures = [item for item in load_figures(args.document) if figure_in_scope(item[2], pages)]
    if not figures:
        print("figure: nessun asset nel perimetro")
        return
    page_cache: dict[tuple[str, int], list[TextLine]] = {}
    manifests: dict[Path, dict] = {}
    plans: list[CropPlan] = []
    for manifest_path, manifest, figure in figures:
        manifests[manifest_path] = manifest
        if figure_already_processed(figure):
            print(f"[SKIP] crop già applicato: {figure['id']} p.{figure['pdfPage']}")
            continue
        document = manifest["document"]
        page = int(figure["pdfPage"])
        key = (document, page)
        if key not in page_cache:
            page_cache[key] = parse_page_lines(PDFS[document], page)
        plan = make_plan(manifest_path, figure, {page: page_cache[key]})
        if plan is not None:
            plans.append(plan)
            print(
                f"[PLAN] {plan.official_number} p.{figure['pdfPage']}: "
                f"y={plan.old_region['y']}..{plan.new_region['y'] + plan.new_region['height']} "
                f"({plan.image_width}x{plan.image_height}->{plan.image_width}x{plan.pixel_height})"
            )
    print(f"figure: {len(plans)}/{len(figures)} crop pianificati")
    if not args.apply:
        return
    changed_images, changed_manifests = apply_plans(plans, manifests)
    changed_units = update_units(plans)
    print(f"figure: aggiornati {changed_images} PNG, {changed_manifests} manifest e {changed_units} unità")


if __name__ == "__main__":
    main()
