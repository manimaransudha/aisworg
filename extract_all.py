import os
import glob
import re

base_dir = "/Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)"
output_file = "/Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/Events and Lifecycles.md"

def get_chapter_num(path):
    filename = os.path.basename(path)
    m = re.search(r"Chapter\s+(\d+)", filename, re.IGNORECASE)
    return int(m.group(1)) if m else 999

chapter_files = sorted(glob.glob(os.path.join(base_dir, "**/*.md"), recursive=True), key=get_chapter_num)
chapter_files = [f for f in chapter_files if os.path.basename(f).startswith("Chapter")]

output_lines = [
    "# Book 3 Refined – Events and Lifecycle States Catalog",
    "",
    "This document consolidates all Lifecycle States and Events defined across all chapters of *Book 3 (Refined)* specification for the `aisworg` application.",
    "",
    "---",
    ""
]

for filepath in chapter_files:
    filename = os.path.basename(filepath)
    rel_path = os.path.relpath(filepath, base_dir)
    
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Title extraction
    title_match = re.search(r"^#\s+(Chapter\s+\d+.*)$", content, re.MULTILINE)
    ch_title = title_match.group(1).strip() if title_match else f"Chapter {get_chapter_num(filepath)}"
    # Cleanup trailing/leading markdown or remarks
    ch_title = re.sub(r"\s*–\s*", " – ", ch_title)
    
    # Description / Purpose extraction
    purpose_match = re.search(r"##\s+\d*\.?\s*Purpose\s*\n+([\s\S]*?)(?=\n##|\n#|$)", content, re.IGNORECASE)
    def_match = re.search(r"##\s+\d*\.?\s*Definition\s*\n+([\s\S]*?)(?=\n##|\n#|$)", content, re.IGNORECASE)
    
    desc = ""
    if purpose_match:
        raw_p = purpose_match.group(1).strip()
        # Clean remarks or comments
        raw_p = re.sub(r"\[Remarks:[\s\S]*?\]", "", raw_p).strip()
        paragraphs = [p.strip() for p in raw_p.split("\n\n") if p.strip() and not p.strip().startswith("[")]
        desc = paragraphs[0] if paragraphs else ""
    elif def_match:
        raw_d = def_match.group(1).strip()
        paragraphs = [p.strip() for p in raw_d.split("\n\n") if p.strip() and not p.strip().startswith("[")]
        desc = paragraphs[0] if paragraphs else ""

    desc = desc.replace("\n", " ")

    # Lifecycle section extraction
    # Search for headings like "# Lifecycle", "## Lifecycle", "## State Management", etc.
    lifecycle_sec = ""
    lf_match = re.search(r"^(#+\s+.*(?:lifecycle|state machine|seu lifecycle|work item lifecycle|pack lifecycle|version lifecycle|decision lifecycle|knowledge lifecycle|evidence lifecycle|deliverable lifecycle|participant lifecycle|runtime lifecycle|policy lifecycle|obligation lifecycle|review lifecycle|governance lifecycle|compliance lifecycle|security lifecycle|tenant lifecycle|checklist versioning and lifecycle).*\n[\s\S]*?)(?=\n#\s|\n##\s+[0-9]+\.|\Z)", content, re.IGNORECASE | re.MULTILINE)
    if lf_match:
        lifecycle_sec = lf_match.group(1).strip()
    
    # Events section extraction
    events_sec = ""
    ev_match = re.search(r"^(#+\s+.*(?:events|subsystem events|event categories).*\n[\s\S]*?)(?=\n#\s|\n##\s+[0-9]+\.|\Z)", content, re.IGNORECASE | re.MULTILINE)
    if ev_match:
        events_sec = ev_match.group(1).strip()

    output_lines.append(f"## {ch_title}")
    output_lines.append("")
    output_lines.append("### 1. Entity Overview")
    output_lines.append(f"- **Chapter:** [{filename}](file://{filepath})")
    if desc:
        output_lines.append(f"- **Description:** {desc}")
    output_lines.append("")
    output_lines.append("---")
    output_lines.append("")
    output_lines.append("### 2. Lifecycle States & Transitions")
    output_lines.append("")
    if lifecycle_sec:
        output_lines.append(lifecycle_sec)
    else:
        output_lines.append("*No explicit entity lifecycle section defined in this chapter.*")
    output_lines.append("")
    output_lines.append("---")
    output_lines.append("")
    output_lines.append("### 3. Subsystem Events")
    output_lines.append("")
    if events_sec:
        output_lines.append(events_sec)
    else:
        output_lines.append("*No explicit subsystem events section defined in this chapter.*")
    output_lines.append("")
    output_lines.append("---")
    output_lines.append("")

print("Extraction complete. Writing scratch output...")
with open("/Users/msudha/.gemini/antigravity-ide/brain/cb641a6c-1430-4329-81bc-2da2fff5b3fc/scratch/extracted.md", "w", encoding="utf-8") as out:
    out.write("\n".join(output_lines))
print("Done!")
