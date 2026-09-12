import os
import glob
import re

base_dir = "/Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)"
target_path = "/Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)/Events and Lifecycles.md"

def get_chapter_num(path):
    filename = os.path.basename(path)
    m = re.search(r"Chapter\s+(\d+)", filename, re.IGNORECASE)
    return int(m.group(1)) if m else 999

chapter_files = sorted(glob.glob(os.path.join(base_dir, "**/*.md"), recursive=True), key=get_chapter_num)
chapter_files = [f for f in chapter_files if os.path.basename(f).startswith("Chapter")]

output = [
    "# Book 3 Refined – Events and Lifecycle States Catalog",
    "",
    "This document consolidates all Lifecycle States and Events defined across all chapters of *Book 3 (Refined)* specification for the `aisworg` application.",
    "",
    "---",
    ""
]

def extract_section_by_keywords(content, keywords):
    """Finds a section heading containing any of the keywords and returns text up to the next heading of same or higher level."""
    pattern = r"^(##?\s+.*(?:" + "|".join(keywords) + r").*\n[\s\S]*?)(?=\n##?\s+|\Z)"
    match = re.search(pattern, content, re.IGNORECASE | re.MULTILINE)
    if not match:
        return ""
    
    raw = match.group(1).strip()
    
    # Strip away implementation specifics / audit / realization sections
    raw = re.split(r"\n#+\s+(?:18\.|19\.|20\.|21\.|22\.)?\s*(?:Implementation Specifics|Realisation|Code-verified audit|Current build)", raw, flags=re.IGNORECASE)[0].strip()
    
    # Strip the matching section header itself so we don't duplicate headers
    lines = raw.split("\n")
    if lines and re.match(r"^#+\s+", lines[0]):
        lines = lines[1:]
        
    cleaned_lines = []
    for line in lines:
        # Strip internal horizontal rules to prevent breaking the overall catalog structure
        if line.strip() == "---":
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()

for filepath in chapter_files:
    filename = os.path.basename(filepath)
    rel_path = os.path.relpath(filepath, base_dir)
    
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Chapter Title - match any level heading containing Chapter N
    title_match = re.search(r"^#+\s+(Chapter\s+\d+.*)$", content, re.MULTILINE)
    ch_title = title_match.group(1).strip() if title_match else f"Chapter {get_chapter_num(filepath)}"
    ch_title = re.sub(r"^[#\s]+", "", ch_title)
    ch_title = re.sub(r"\s*–\s*", " – ", ch_title)
    
    # Description / Purpose
    purpose_match = re.search(r"##\s+\d*\.?\s*Purpose\s*\n+([\s\S]*?)(?=\n##|\n#|$)", content, re.IGNORECASE)
    def_match = re.search(r"##\s+\d*\.?\s*Definition\s*\n+([\s\S]*?)(?=\n##|\n#|$)", content, re.IGNORECASE)
    scope_match = re.search(r"##\s+\d*\.?\s*Scope\s*\n+([\s\S]*?)(?=\n##|\n#|$)", content, re.IGNORECASE)
    
    desc = ""
    if purpose_match:
        raw_p = purpose_match.group(1).strip()
        raw_p = re.sub(r"\[Remarks:[\s\S]*?\]", "", raw_p).strip()
        paragraphs = [p.strip() for p in raw_p.split("\n\n") if p.strip() and not p.strip().startswith("[")]
        desc = paragraphs[0] if paragraphs else ""
    elif def_match:
        raw_d = def_match.group(1).strip()
        paragraphs = [p.strip() for p in raw_d.split("\n\n") if p.strip() and not p.strip().startswith("[")]
        desc = paragraphs[0] if paragraphs else ""
    elif scope_match:
        raw_s = scope_match.group(1).strip()
        paragraphs = [p.strip() for p in raw_s.split("\n\n") if p.strip() and not p.strip().startswith("[")]
        desc = paragraphs[0] if paragraphs else ""

    desc = re.sub(r"\s+", " ", desc).strip()

    # Extract Lifecycle section
    lifecycle_text = extract_section_by_keywords(content, ["lifecycle", "state machine", "states"])
    
    # Extract Events section
    events_text = extract_section_by_keywords(content, ["events", "subsystem events", "event model", "event categories"])

    output.append(f"## {ch_title}")
    output.append("")
    output.append("### 1. Entity Overview")
    output.append(f"- **Chapter:** [{filename}](file://{filepath})")
    if desc:
        output.append(f"- **Description:** {desc}")
    output.append("")
    output.append("### 2. Lifecycle States & Transitions")
    output.append("")
    if lifecycle_text:
        output.append(lifecycle_text)
    else:
        output.append("*No explicit entity lifecycle section defined in this chapter.*")
    output.append("")
    output.append("### 3. Subsystem Events")
    output.append("")
    if events_text:
        output.append(events_text)
    else:
        output.append("*No explicit subsystem events section defined in this chapter.*")
    output.append("")
    output.append("---")
    output.append("")

print("Writing clean catalog file...")
with open(target_path, "w", encoding="utf-8") as f:
    f.write("\n".join(output))

print("Successfully written to", target_path)
