"""Extract the official figures of Circolare 2019 C3, editorial step 2."""

from __future__ import annotations

import hashlib
import binascii
import json
import struct
import subprocess
import tempfile
import zlib
from pathlib import Path

from lib.poppler import resolve_pdftoppm

REPO = Path(__file__).resolve().parents[1]
PDF = REPO / "raw-sources" / "circ2019" / "circolare-7-2019.pdf"
MANIFEST = REPO / "corpus" / "assets" / "circ2019" / "core-figure-placeholders.json"
OUTPUT_DIR = REPO / "corpus" / "assets" / "figures" / "circ2019"
PDFTOPPM = resolve_pdftoppm()
RESOLUTION = 300
SCALE = RESOLUTION / 72


FIGURES = {
    "C3.3.5": {
        "unit": "c3.3.8.1.2",
        "page": 58,
        "bbox": (204, 89, 392, 255),
        "caption": "Figura C3.3.5 – Schema di riferimento per coperture piane",
    },
    "C3.3.6": {
        "unit": "c3.3.8.1.2",
        "page": 58,
        "bbox": (170, 390, 432, 595),
        "caption": (
            "Figura C3.3.6 – a) Suddivisione delle coperture piane in zone "
            "di uguale pressione; b) Altezza di riferimento per coperture "
            "piane con parapetti o raccordi (curvi e piani)"
        ),
    },
    "C3.3.7": {
        "unit": "c3.3.8.1.3",
        "page": 59,
        "bbox": (168, 328, 427, 395),
        "caption": "Figura C3.3.7 – Schema di riferimento per coperture a semplice falda",
    },
    "C3.3.8": {
        "unit": "c3.3.8.1.3",
        "page": 59,
        "bbox": (181, 427, 425, 569),
        "caption": (
            "Figura C3.3.8 – Coperture a semplice falda: valori del "
            "coefficiente cpe; vento perpendicolare alla direzione del colmo"
        ),
    },
    "C3.3.9": {
        "unit": "c3.3.8.1.3",
        "page": 60,
        "bbox": (185, 101, 420, 245),
        "caption": (
            "Figura C3.3.9 – Coefficienti di pressione per coperture a "
            "semplice falda: vento parallelo alla direzione del colmo"
        ),
    },
    "C3.3.10": {
        "unit": "c3.3.8.1.3",
        "page": 60,
        "bbox": (195, 392, 430, 627),
        "caption": (
            "Figura C3.3.10 – Suddivisione delle coperture a semplice falda "
            "in zone di uguale pressione"
        ),
    },
    "C3.3.11": {
        "unit": "c3.3.8.1.4",
        "page": 61,
        "bbox": (178, 472, 418, 543),
        "caption": "Figura C3.3.11 – Schema di riferimento per coperture a falda doppia",
    },
    "C3.3.12": {
        "unit": "c3.3.8.1.4",
        "page": 61,
        "bbox": (160, 566, 425, 704),
        "caption": (
            "Figura C3.3.12 – Coefficienti di pressione per coperture a "
            "doppia falda: falda sottovento con vento in direzione "
            "perpendicolare al colmo"
        ),
    },
    "C3.3.13": {
        "unit": "c3.3.8.1.4",
        "page": 62,
        "bbox": (190, 208, 417, 335),
        "caption": (
            "Figura C3.3.13 – Coefficienti di pressione per coperture a "
            "doppia falda: vento in direzione parallela al colmo"
        ),
    },
    "C3.3.14": {
        "unit": "c3.3.8.1.4",
        "page": 62,
        "parts": [
            (62, (205, 530, 390, 690)),
            (63, (190, 90, 405, 197)),
        ],
        "caption": (
            "Figura C3.3.14 – Suddivisione delle coperture a falda doppia "
            "in zone di uguale pressione"
        ),
    },
    "C3.3.15": {
        "unit": "c3.3.8.1.5",
        "page": 64,
        "bbox": (180, 327, 416, 380),
        "caption": "Figura C3.3.15 – Schema delle coperture a padiglione",
    },
    "C3.3.16": {
        "unit": "c3.3.8.1.5",
        "page": 64,
        "bbox": (158, 430, 422, 568),
        "caption": (
            "Figura C3.3.16 – Coefficienti di pressione per coperture a "
            "padiglione: falde laterali"
        ),
    },
    "C3.3.17": {
        "unit": "c3.3.8.1.5",
        "page": 65,
        "bbox": (160, 90, 385, 420),
        "caption": (
            "Figura C3.3.17 – Suddivisione delle coperture a padiglione "
            "in zone di uguale pressione"
        ),
    },
    "C3.3.18": {
        "unit": "c3.3.8.1.6",
        "page": 66,
        "bbox": (178, 125, 417, 428),
        "caption": "Figura C3.3.18 – Suddivisione delle coperture a falda multipla",
    },
    "C3.3.19": {
        "unit": "c3.3.8.1.7",
        "page": 67,
        "bbox": (176, 190, 425, 585),
        "caption": (
            "Figura C3.3.19 – a) e b) Schema di riferimento per coperture "
            "a volta cilindrica; c) coefficienti di pressione per coperture "
            "a volta cilindrica"
        ),
    },
    "C3.3.20": {
        "unit": "c3.3.8.2",
        "page": 68,
        "bbox": (180, 160, 420, 250),
        "caption": (
            "Figura C3.3.20 – Differenze nel flusso dell’aria per tettoie "
            "con φ=0 e φ=1"
        ),
    },
    "C3.3.21": {
        "unit": "c3.3.8.2.1",
        "page": 68,
        "bbox": (175, 435, 420, 577),
        "caption": (
            "Figura C3.3.21 – Coefficienti di pressione complessiva per "
            "tettoie a semplice falda"
        ),
    },
    "C3.3.22": {
        "unit": "c3.3.8.2.1",
        "page": 69,
        "bbox": (160, 89, 435, 216),
        "caption": (
            "Figura C3.3.22 – Tettoie a semplice falda: posizione del punto "
            "di applicazione della forza risultante in funzione della "
            "direzione di provenienza del vento e della direzione della forza"
        ),
    },
    "C3.3.23": {
        "unit": "c3.3.8.2.2",
        "page": 69,
        "bbox": (180, 371, 416, 508),
        "caption": (
            "Figura C3.3.23 – Coefficienti di pressione complessiva per "
            "tettoie a falda doppia"
        ),
    },
    "C3.3.24": {
        "unit": "c3.3.8.2.2",
        "page": 70,
        "bbox": (167, 89, 428, 317),
        "caption": (
            "Figura C3.3.24 – Tettoie a doppia falda: posizione del punto "
            "di applicazione delle forze risultanti in funzione della "
            "direzione della forza; a) schema per α>0°; b) schema per α<0°"
        ),
    },
    "C3.3.25": {
        "unit": "c3.3.8.2.3",
        "page": 70,
        "bbox": (180, 424, 415, 487),
        "caption": (
            "Figura C3.3.25 – Tettoie a falda multipla: individuazione "
            "dei vari elementi"
        ),
    },
}


def render_crop(
    page: int,
    bbox: tuple[int, int, int, int],
    destination: Path,
) -> None:
    x1, y1, x2, y2 = bbox
    prefix = destination.with_suffix("")
    subprocess.run(
        [
            str(PDFTOPPM),
            "-f",
            str(page),
            "-l",
            str(page),
            "-r",
            str(RESOLUTION),
            "-png",
            "-singlefile",
            "-x",
            str(round(x1 * SCALE)),
            "-y",
            str(round(y1 * SCALE)),
            "-W",
            str(round((x2 - x1) * SCALE)),
            "-H",
            str(round((y2 - y1) * SCALE)),
            str(PDF),
            str(prefix),
        ],
        check=True,
    )


def render_crop_ppm(
    page: int,
    bbox: tuple[int, int, int, int],
    destination: Path,
) -> None:
    x1, y1, x2, y2 = bbox
    prefix = destination.with_suffix("")
    subprocess.run(
        [
            str(PDFTOPPM),
            "-f",
            str(page),
            "-l",
            str(page),
            "-r",
            str(RESOLUTION),
            "-singlefile",
            "-x",
            str(round(x1 * SCALE)),
            "-y",
            str(round(y1 * SCALE)),
            "-W",
            str(round((x2 - x1) * SCALE)),
            "-H",
            str(round((y2 - y1) * SCALE)),
            str(PDF),
            str(prefix),
        ],
        check=True,
    )


def read_ppm(path: Path) -> tuple[int, int, bytes]:
    payload = path.read_bytes()
    position = 0
    tokens: list[bytes] = []
    while len(tokens) < 4:
        while position < len(payload) and payload[position] in b" \t\r\n":
            position += 1
        if payload[position : position + 1] == b"#":
            position = payload.index(b"\n", position) + 1
            continue
        end = position
        while end < len(payload) and payload[end] not in b" \t\r\n":
            end += 1
        tokens.append(payload[position:end])
        position = end

    magic, width, height, maximum = tokens
    if magic != b"P6" or maximum != b"255":
        raise ValueError(f"Formato PPM non supportato: {path}")
    while position < len(payload) and payload[position] in b" \t\r\n":
        position += 1
    pixels = payload[position:]
    expected = int(width) * int(height) * 3
    if len(pixels) != expected:
        raise ValueError(f"Dimensione PPM inattesa: {path}")
    return int(width), int(height), pixels


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(kind + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)


def write_png(path: Path, width: int, height: int, pixels: bytes) -> None:
    stride = width * 3
    scanlines = b"".join(
        b"\x00" + pixels[row * stride : (row + 1) * stride]
        for row in range(height)
    )
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", header)
        + png_chunk(b"IDAT", zlib.compress(scanlines, 9))
        + png_chunk(b"IEND", b"")
    )


def render_figure(spec: dict[str, object], destination: Path) -> None:
    parts = spec.get("parts")
    if not parts:
        render_crop(int(spec["page"]), spec["bbox"], destination)
        return

    with tempfile.TemporaryDirectory(prefix="circ3-step2-") as temporary:
        images: list[tuple[int, int, bytes]] = []
        for index, (page, bbox) in enumerate(parts):
            part = Path(temporary) / f"part-{index}.ppm"
            render_crop_ppm(page, bbox, part)
            images.append(read_ppm(part))

        width = max(image[0] for image in images)
        gap = round(8 * SCALE)
        height = sum(image[1] for image in images) + gap * (len(images) - 1)
        combined = bytearray(b"\xff" * (width * height * 3))
        top = 0
        for image_width, image_height, pixels in images:
            left = (width - image_width) // 2
            for row in range(image_height):
                source_start = row * image_width * 3
                target_start = ((top + row) * width + left) * 3
                combined[target_start : target_start + image_width * 3] = pixels[
                    source_start : source_start + image_width * 3
                ]
            top += image_height + gap
        write_png(destination, width, height, bytes(combined))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if not PDFTOPPM.exists():
        raise FileNotFoundError(f"pdftoppm non trovato: {PDFTOPPM}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    reviewed = set(FIGURES)
    manifest["figures"] = [
        figure
        for figure in manifest["figures"]
        if figure.get("officialNumber") not in reviewed
    ]

    for number, spec in FIGURES.items():
        filename = f"fig{number.lower()}.png"
        destination = OUTPUT_DIR / filename
        render_figure(spec, destination)
        bbox = spec.get("bbox") or spec["parts"][0][1]
        x1, y1, x2, y2 = bbox
        manifest["figures"].append(
            {
                "id": (
                    "urn:structural-codes:it:asset:figure:circ2019:"
                    f"{number.lower()}"
                ),
                "unitId": (
                    "urn:structural-codes:it:unit:circ2019:"
                    f"{spec['unit']}"
                ),
                "officialNumber": number,
                "pdfPage": spec["page"],
                "caption": spec["caption"],
                "alt": spec["caption"],
                "imagePath": f"figures/circ2019/{filename}",
                "region": {
                    "coordinateSystem": "pdf-points-top-left",
                    "x": x1,
                    "y": y1,
                    "width": x2 - x1,
                    "height": y2 - y1,
                },
                "sha256": sha256(destination),
            }
        )

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf8",
    )
    print(f"circ3-step2-figures: extracted {len(FIGURES)} figures")


if __name__ == "__main__":
    main()
