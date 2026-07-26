from __future__ import annotations

import json
import statistics
from pathlib import Path

import pdfplumber


REPO = Path(__file__).resolve().parents[1]
OUTPUT = REPO / "migration" / "layout" / "core-editorial-layout.json"
DOCUMENTS = {
    "ntc2018": {
        "source": REPO
        / "raw-sources"
        / "ntc2018"
        / "gu-42-so8-2018-02-20.pdf",
        "pages": range(35, 71),
    },
    "circ2019": {
        "source": REPO
        / "raw-sources"
        / "circ2019"
        / "circolare-7-2019.pdf",
        "pages": range(32, 100),
    },
}


def normalized(value: str) -> str:
    return " ".join(value.replace("\u00a0", " ").split())


def grouped_lines(page: pdfplumber.page.Page) -> list[dict]:
    words = page.extract_words(
        keep_blank_chars=False,
        use_text_flow=False,
        extra_attrs=["fontname", "size"],
    )
    lines: list[list[dict]] = []
    for word in sorted(words, key=lambda item: (round(item["top"], 1), item["x0"])):
        line = next(
            (
                candidate
                for candidate in reversed(lines[-4:])
                if abs(statistics.median(item["top"] for item in candidate) - word["top"])
                <= 1.4
            ),
            None,
        )
        if line is None:
            lines.append([word])
        else:
            line.append(word)

    result = []
    for line in lines:
        ordered = sorted(line, key=lambda item: item["x0"])
        text = normalized(" ".join(item["text"] for item in ordered))
        if not text:
            continue
        total = sum(max(len(item["text"]), 1) for item in ordered)
        bold = sum(
            max(len(item["text"]), 1)
            for item in ordered
            if "bold" in item["fontname"].lower()
        )
        result.append(
            {
                "text": text,
                "top": round(min(item["top"] for item in ordered), 3),
                "bottom": round(max(item["bottom"] for item in ordered), 3),
                "x0": round(min(item["x0"] for item in ordered), 3),
                "x1": round(max(item["x1"] for item in ordered), 3),
                "size": round(statistics.median(item["size"] for item in ordered), 3),
                "boldRatio": round(bold / total, 3),
                "fonts": sorted({item["fontname"] for item in ordered}),
            }
        )
    return result


def is_subheading(line: dict) -> bool:
    text = line["text"]
    if line["boldRatio"] < 0.7 or line["size"] < 7.2:
        return False
    if text.startswith(("Fig.", "Figura ", "Tab.", "Tabella ")):
        return False
    if "(cid:" in text or text in {"A", "B", "C", "D", "E", "d", "e", "s", "μ"}:
        return False
    if text.startswith(("Zona ", "Sottosuolo")):
        return False
    if text.startswith(("—", "Supplemento ordinario", "Serie generale")):
        return False
    if text.endswith((".", ",", ";")):
        return False
    if len(text) > 120:
        return False
    # Numbered headings are already represented by canonical title blocks.
    first = text.split(maxsplit=1)[0].rstrip(".")
    if first.startswith("C"):
        first = first[1:]
    if first and all(part.isdigit() for part in first.split(".")):
        return False
    return True


payload = {
    "formatVersion": 1,
    "method": "pdfplumber-font-layout",
    "documents": {},
}

for document, config in DOCUMENTS.items():
    pages = {}
    with pdfplumber.open(config["source"]) as pdf:
        for pdf_page in config["pages"]:
            lines = grouped_lines(pdf.pages[pdf_page - 1])
            pages[str(pdf_page)] = {
                "boldLines": [
                    {
                        "text": line["text"],
                        "top": line["top"],
                        "bottom": line["bottom"],
                    }
                    for line in lines
                    if is_subheading(line)
                ]
            }
    payload["documents"][document] = {
        "source": str(config["source"].relative_to(REPO)).replace("\\", "/"),
        "pages": pages,
    }

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(OUTPUT)
