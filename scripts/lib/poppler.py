"""Resolve Poppler executables without machine-specific paths."""

from __future__ import annotations

import os
import shutil
from pathlib import Path


def resolve_pdftoppm() -> Path:
    """Return a usable ``pdftoppm`` executable or fail with setup guidance."""

    configured = os.environ.get("STRUCTURAL_CODES_PDFTOPPM")
    candidates = [configured, shutil.which("pdftoppm"), shutil.which("pdftoppm.exe")]

    for candidate in candidates:
        if candidate:
            path = Path(candidate).expanduser().resolve()
            if path.is_file():
                return path

    raise FileNotFoundError(
        "pdftoppm non trovato: installare Poppler e aggiungerlo a PATH, oppure "
        "impostare STRUCTURAL_CODES_PDFTOPPM sul percorso dell'eseguibile."
    )
