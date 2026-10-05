#!/usr/bin/env python3
"""Rewrite the traceability markdown table in design/implementation chapter files.

Reorders columns to: Intent Met (icon) | Intent (+ Ref: line) | Code Citation | Finding
Replaces the Intent Met text value with an icon and prepends an icon legend
before the table. No other part of the file is touched.
"""
import re
import sys
from pathlib import Path

ICONS = {
    "Fully met": "✅",       # white heavy check mark
    "Partially met": "⚠️",  # warning sign
    "Not met": "❌",         # cross mark
    "Not verifiable": "❓",  # question mark
}

LEGEND = (
    "**Legend:** "
    + "  ".join(f"{icon} {label}" for label, icon in ICONS.items())
    + "\n"
)

TABLE_RE = re.compile(
    r"^\|\s*Intent\s*\|\s*Specification Reference\s*\|\s*Code Citation\s*\|\s*Finding\s*\|\s*Intent Met\s*\|\s*\n"
    r"\|[-: |]+\|\s*\n"
    r"(?:\|.*\|\s*\n?)+",
    re.MULTILINE,
)

ROW_SPLIT_RE = re.compile(r"\|(.*)\|(.*)\|(.*)\|(.*)\|(.*)\|")


def split_row(line: str):
    line = line.rstrip("\n")
    # strip leading/trailing pipe, split remaining on unescaped pipes
    inner = line.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|"):
        inner = inner[:-1]
    return [cell.strip() for cell in inner.split("|")]


CODE_RE = re.compile(r"`([^`]+)`")


def to_html_cell(text: str) -> str:
    return CODE_RE.sub(r"<code>\1</code>", text)


def rewrite_table(match: re.Match) -> str:
    block = match.group(0)
    lines = block.splitlines()
    data_lines = lines[2:]

    cell_style = "word-break:break-word; overflow-wrap:anywhere;"

    out_rows = [
        '<table style="width:100%; table-layout:fixed;">',
        "  <colgroup>",
        '    <col style="width:4%;">',
        '    <col style="width:32%;">',
        '    <col style="width:27%;">',
        '    <col style="width:37%;">',
        "  </colgroup>",
        "  <thead>",
        "    <tr>",
        "      <th></th>",
        "      <th>Intent</th>",
        "      <th>Code Citation</th>",
        "      <th>Finding</th>",
        "    </tr>",
        "  </thead>",
        "  <tbody>",
    ]

    for line in data_lines:
        if not line.strip():
            continue
        cells = split_row(line)
        if len(cells) != 5:
            # leave malformed row untouched, appended as-is
            out_rows.append(line)
            continue
        intent, spec_ref, code_cite, finding, intent_met = cells
        icon = ICONS.get(intent_met, intent_met)
        intent_with_ref = f"{to_html_cell(intent)}<br> Ref: {to_html_cell(spec_ref)}"
        out_rows.append("    <tr>")
        out_rows.append(f'      <td style="{cell_style}">{icon}</td>')
        out_rows.append(f'      <td style="{cell_style}">{intent_with_ref}</td>')
        out_rows.append(f'      <td style="{cell_style}">{to_html_cell(code_cite)}</td>')
        out_rows.append(f'      <td style="{cell_style}">{to_html_cell(finding)}</td>')
        out_rows.append("    </tr>")

    out_rows.append("  </tbody>")
    out_rows.append("</table>")

    return LEGEND + "\n" + "\n".join(out_rows) + "\n"


def process(src: Path, dst: Path):
    text = src.read_text(encoding="utf-8")
    if not TABLE_RE.search(text):
        print(f"SKIP (no matching table): {src}")
        return False
    new_text = TABLE_RE.sub(rewrite_table, text)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(new_text, encoding="utf-8")
    print(f"WROTE: {dst}")
    return True


def main(argv):
    if len(argv) != 2:
        print("Usage: rewrite_traceability_tables.py <input.md> <output.md>")
        return 1
    src = Path(argv[0])
    dst = Path(argv[1])
    process(src, dst)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
