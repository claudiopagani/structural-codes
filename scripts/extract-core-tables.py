from __future__ import annotations

import json
import re
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

import pdfplumber


REPO = Path(__file__).resolve().parents[1]
SNAPSHOT = REPO / "migration" / "source-snapshots" / "core-editorial-text-blocks.json"
PLACEMENTS = REPO / "migration" / "layout" / "core-table-placements.json"
DOCUMENTS = {
    "ntc2018": {
        "source": REPO / "raw-sources" / "ntc2018" / "gu-42-so8-2018-02-20.pdf",
        "sourceId": "gu-so8-2018-ntc",
    },
    "circ2019": {
        "source": REPO / "raw-sources" / "circ2019" / "circolare-7-2019.pdf",
        "sourceId": "circ-7-2019",
    },
}
CAPTION = re.compile(
    r"^\s*(?:Tab\.|Tabella)\s+"
    r"(?P<number>C?\.?\d+(?:\.\d+)+(?:\.[IVX]+))"
    r"(?:\s*[-–:]\s*|\s+(?=[A-Z]))(?P<caption>.*)$",
    re.IGNORECASE,
)


def clean(value: str | None) -> str:
    if not value:
        return ""
    value = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", value)
    return re.sub(r"\s+", " ", value).strip()


def comparable(value: str) -> str:
    return "".join(character.lower() for character in clean(value) if character.isalnum())


def normalize_number(value: str) -> str:
    value = value.upper().replace("C.", "C")
    return value


def grouped_lines(page: pdfplumber.page.Page) -> list[dict]:
    words = page.extract_words(keep_blank_chars=False, use_text_flow=False)
    groups: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (round(item["top"], 1), item["x0"])):
        target = next(
            (
                group
                for group in reversed(groups[-5:])
                if abs(sum(item["top"] for item in group) / len(group) - word["top"])
                <= 1.5
            ),
            None,
        )
        if target is None:
            groups.append([word])
        else:
            target.append(word)
    return [
        {
            "text": clean(" ".join(word["text"] for word in sorted(group, key=lambda item: item["x0"]))),
            "top": min(word["top"] for word in group),
            "bottom": max(word["bottom"] for word in group),
        }
        for group in groups
    ]


def best_raw_index(raw_lines: list[str], needle: str, start: int) -> tuple[int | None, float]:
    target = comparable(needle)
    if not target:
        return None, 0.0
    best_index = None
    best_score = 0.0
    for index in range(start, len(raw_lines)):
        candidate = comparable(raw_lines[index])
        if not candidate:
            continue
        score = SequenceMatcher(None, target, candidate).ratio()
        if score > best_score:
            best_index = index
            best_score = score
    return best_index, best_score


snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
captions_by_document_page: dict[tuple[str, int], list[dict]] = defaultdict(list)
for unit_id, blocks in snapshot["units"].items():
    document = unit_id.split(":")[-2]
    if document not in DOCUMENTS:
        continue
    for block in blocks:
        if block["kind"] == "heading":
            continue
        raw_lines = block["text"]["raw"].splitlines()
        for index, line in enumerate(raw_lines):
            match = CAPTION.match(line)
            if not match:
                continue
            number = normalize_number(match.group("number"))
            caption = clean(match.group("caption"))
            if len(number.split(".")) < 3:
                continue
            captions_by_document_page[(document, block["evidence"]["pdfPage"])].append(
                {
                    "number": number,
                    "caption": f"Tabella {number}" + (f" - {caption}" if caption else ""),
                    "unitId": unit_id,
                    "page": block["evidence"]["pdfPage"],
                    "start": index,
                    "rawLines": raw_lines,
                }
            )

manifests: dict[str, list[dict]] = defaultdict(list)
placements: dict[str, list[dict]] = defaultdict(list)

for document, config in DOCUMENTS.items():
    with pdfplumber.open(config["source"]) as pdf:
        for (candidate_document, page_number), captions in captions_by_document_page.items():
            if candidate_document != document:
                continue
            page = pdf.pages[page_number - 1]
            lines = grouped_lines(page)
            found = page.find_tables()
            used: set[int] = set()
            for caption in captions:
                marker = comparable(caption["number"])
                caption_lines = [
                    line
                    for line in lines
                    if marker and marker in comparable(line["text"])
                ]
                caption_bottom = (
                    min(caption_lines, key=lambda line: line["top"])["bottom"]
                    if caption_lines
                    else 0
                )
                options = [
                    (index, table)
                    for index, table in enumerate(found)
                    if index not in used and table.bbox[1] >= caption_bottom - 50
                ]
                if not options:
                    continue
                table_index, table = min(
                    options,
                    key=lambda item: abs(item[1].bbox[1] - caption_bottom),
                )
                used.add(table_index)
                extracted = table.extract()
                rows = [
                    [clean(cell) for cell in row]
                    for row in extracted
                    if row and any(clean(cell) for cell in row)
                ]
                if len(rows) < 2 or max(len(row) for row in rows) < 2:
                    continue
                column_count = max(len(row) for row in rows)
                rows = [row + [""] * (column_count - len(row)) for row in rows]
                number_slug = caption["number"].lower()
                asset_id = (
                    f"urn:structural-codes:it:asset:table:{document}:{number_slug}"
                )
                if any(asset["id"] == asset_id for asset in manifests[document]):
                    continue
                manifests[document].append(
                    {
                        "id": asset_id,
                        "unitId": caption["unitId"],
                        "officialNumber": caption["number"],
                        "pdfPage": page_number,
                        "caption": caption["caption"],
                        "columnCount": column_count,
                        "headers": [[{"text": cell} for cell in rows[0]]],
                        "rows": [
                            [{"text": cell} for cell in row] for row in rows[1:]
                        ],
                        "notes": [
                            "Griglia ricostruita automaticamente dalla geometria del PDF; da confrontare con la fonte ufficiale."
                        ],
                    }
                )

                after = [
                    line
                    for line in lines
                    if line["top"] > table.bbox[3] + 1 and comparable(line["text"])
                ]
                raw_end = caption["start"]
                if after:
                    next_index, score = best_raw_index(
                        caption["rawLines"],
                        after[0]["text"],
                        caption["start"] + 1,
                    )
                    if next_index is not None and score >= 0.48:
                        raw_end = max(caption["start"], next_index - 1)
                if raw_end == caption["start"]:
                    inside = [
                        line
                        for line in lines
                        if line["top"] >= table.bbox[1] - 2
                        and line["bottom"] <= table.bbox[3] + 2
                    ]
                    if inside:
                        last_index, score = best_raw_index(
                            caption["rawLines"],
                            inside[-1]["text"],
                            caption["start"] + 1,
                        )
                        if last_index is not None and score >= 0.35:
                            raw_end = last_index
                if (
                    document == "circ2019"
                    and caption["number"] == "C4.1.III"
                    and page_number == 93
                ):
                    raw_end = 24
                unit_number = caption["unitId"].split(":")[-1]
                if document == "circ2019":
                    unit_number = unit_number.upper()
                key = f"{document}:{unit_number}@{page_number}"
                placements[key].append(
                    {
                        "start": caption["start"],
                        "end": raw_end,
                        "assetId": asset_id,
                    }
                )

for document, config in DOCUMENTS.items():
    manifest = {
        "$schema": "urn:structural-codes:schema:asset-manifest:v2",
        "schemaVersion": "2.0.0-alpha.1",
        "recordType": "asset-manifest",
        "document": document,
        "section": "core-tables",
        "sourceId": config["sourceId"],
        "status": "transcribed-unreviewed",
        "formulas": [],
        "tables": manifests[document],
        "figures": [],
    }
    output = REPO / "corpus" / "assets" / document / "core-tables.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

PLACEMENTS.parent.mkdir(parents=True, exist_ok=True)
PLACEMENTS.write_text(
    json.dumps(
        {"formatVersion": 1, "placements": placements},
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
print(
    f"core-tables: {sum(len(value) for value in manifests.values())} tabelle, "
    f"{sum(len(value) for value in placements.values())} posizionamenti"
)
