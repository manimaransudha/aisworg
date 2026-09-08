import os
import glob
import re
import json

spec_dir = "/Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)"
obs_dir = "/Volumes/Chennai/gitrepo/aisworg/design/observations"
src_dir = "/Volumes/Chennai/gitrepo/aisworg/src"

def get_spec_files():
    files = sorted(glob.glob(os.path.join(spec_dir, "**/*.md"), recursive=True))
    spec_map = {}
    for f in files:
        fname = os.path.basename(f)
        match = re.search(r"Chapter\s+(\d+)", fname, re.IGNORECASE)
        if match:
            ch_num = int(match.group(1))
            spec_map[ch_num] = f
    return spec_map

def get_obs_files():
    files = sorted(glob.glob(os.path.join(obs_dir, "Chapter_*.md")))
    obs_map = {}
    for f in files:
        fname = os.path.basename(f)
        match = re.search(r"Chapter_(\d+)_", fname)
        if match:
            ch_num = int(match.group(1))
            obs_map[ch_num] = f
    return obs_map

spec_map = get_spec_files()
obs_map = get_obs_files()

audit_results = {}

for ch_num in range(1, 48):
    if ch_num not in spec_map:
        print(f"Spec for Chapter {ch_num:02d} not found!")
        continue
    if ch_num not in obs_map:
        print(f"Obs for Chapter {ch_num:02d} not found!")
        continue

    spec_path = spec_map[ch_num]
    obs_path = obs_map[ch_num]

    with open(spec_path, "r", encoding="utf-8") as f:
        spec_text = f.read()
    with open(obs_path, "r", encoding="utf-8") as f:
        obs_text = f.read()

    # Parse headings ##
    headings = []
    lines = spec_text.splitlines()
    for line in lines:
        if line.startswith("## "):
            h_text = line[3:].strip()
            headings.append(h_text)

    ch_audit = []
    for h in headings:
        # Check if heading is in obs_text
        # Extract section number if present
        m_num = re.match(r"^(\d+[\.\d]*)\s*(.*)", h)
        sec_num = m_num.group(1) if m_num else ""
        sec_title = m_num.group(2) if m_num else h

        # Normalize title for matching
        clean_title = re.sub(r"[^\w\s]", "", sec_title).strip()
        keywords = [w for w in clean_title.split() if len(w) > 3 and w.lower() not in ["model", "chapter", "specification", "section", "requirements", "requirements"]]

        # Is section number or key title phrase in obs_text?
        found_in_obs = False
        if sec_num and (f"§{sec_num}" in obs_text or f"Section {sec_num}" in obs_text or f"## {sec_num}" in obs_text or f"{sec_num}." in obs_text):
            found_in_obs = True
        elif clean_title.lower() in obs_text.lower():
            found_in_obs = True
        else:
            # check if at least 2 keywords match
            matches = sum(1 for kw in keywords if kw.lower() in obs_text.lower())
            if len(keywords) > 0 and matches >= min(2, len(keywords)):
                found_in_obs = True

        ch_audit.append({
            "heading": h,
            "sec_num": sec_num,
            "sec_title": sec_title,
            "found_in_obs": found_in_obs
        })

    audit_results[ch_num] = {
        "spec_file": os.path.basename(spec_path),
        "obs_file": os.path.basename(obs_path),
        "headings_count": len(headings),
        "sections": ch_audit
    }

output_path = "/Users/msudha/.gemini/antigravity-ide/brain/fb723650-cacb-4b59-bf04-10fa9e5f8c34/scratch/audit_summary.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(audit_results, f, indent=2)

print(f"Audit completed for {len(audit_results)} chapters. Results saved to {output_path}.")
