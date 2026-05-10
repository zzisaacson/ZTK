#!/usr/bin/env python3
from __future__ import annotations

import argparse
import pathlib
import sys


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Extract text from all PDFs under a directory."
    )
    parser.add_argument(
        "--input",
        default="context",
        help="Input directory to scan for PDFs (default: context)",
    )
    parser.add_argument(
        "--output",
        default="context/extracted_text",
        help="Output directory for extracted text files",
    )
    args = parser.parse_args()

    input_dir = pathlib.Path(args.input)
    output_dir = pathlib.Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    vendor_path = pathlib.Path(".vendor")
    if vendor_path.exists():
        sys.path.insert(0, str(vendor_path.resolve()))

    from pypdf import PdfReader  # type: ignore

    pdfs = sorted(input_dir.rglob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {input_dir}")
        return 0

    for pdf_path in pdfs:
        rel = pdf_path.relative_to(input_dir)
        destination = (output_dir / rel).with_suffix(".txt")
        destination.parent.mkdir(parents=True, exist_ok=True)

        reader = PdfReader(str(pdf_path))
        chunks: list[str] = []
        chunks.append(f"# Source: {pdf_path}\n")
        chunks.append(f"# Pages: {len(reader.pages)}\n")
        chunks.append("")

        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            chunks.append(f"\n## Page {i}\n")
            chunks.append(text.strip() if text.strip() else "[No extractable text]")

        destination.write_text("\n".join(chunks), encoding="utf-8")
        print(f"Extracted: {destination}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
