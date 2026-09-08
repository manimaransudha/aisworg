import os
import glob
import re
import json

spec_dir = "/Volumes/Chennai/gitrepo/aisworg/design/foundations/03_Book 3 (Refined)"
obs_dir = "/Volumes/Chennai/gitrepo/aisworg/design/observations"
src_dir = "/Volumes/Chennai/gitrepo/aisworg/src"
artifact_dir = "/Users/msudha/.gemini/antigravity-ide/brain/fb723650-cacb-4b59-bf04-10fa9e5f8c34"

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

# Read audit_summary.json
with open(os.path.join(artifact_dir, "scratch/audit_summary.json"), "r", encoding="utf-8") as f:
    audit_data = json.load(f)

def search_codebase(terms):
    results = []
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            if file.endswith(".ts") or file.endswith(".js") or file.endswith(".json"):
                fpath = os.path.join(root, file)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        for term in terms:
                            if len(term) > 3 and term.lower() in content.lower():
                                rel_path = os.path.relpath(fpath, "/Volumes/Chennai/gitrepo/aisworg")
                                results.append((file, rel_path, term))
                                break
                except Exception:
                    pass
    return results

chapter_updates = {}
total_missing_sections = 0
total_verified_built = 0
total_verified_gaps = 0

for ch_str, data in audit_data.items():
    ch_num = int(ch_str)
    if ch_num not in spec_map or ch_num not in obs_map:
        continue

    spec_path = spec_map[ch_num]
    obs_path = obs_map[ch_num]

    missing = [s for s in data["sections"] if not s["found_in_obs"]]
    if not missing:
        continue

    total_missing_sections += len(missing)

    with open(spec_path, "r", encoding="utf-8") as f:
        spec_content = f.read()
    with open(obs_path, "r", encoding="utf-8") as f:
        obs_content = f.read()

    ch_missing_details = []

    for item in missing:
        heading = item["heading"]
        sec_num = item["sec_num"]
        sec_title = item["sec_title"]

        pattern = re.escape("## " + heading) + r"(.*?)(?=\n## |\Z)"
        m = re.search(pattern, spec_content, re.DOTALL)
        body = m.group(1).strip() if m else ""

        keywords = [w for w in re.sub(r"[^\w\s]", "", sec_title).split() if len(w) > 3 and w.lower() not in ["model", "chapter", "specification", "section", "requirements"]]
        code_matches = search_codebase(keywords) if keywords else []

        status = "Fully Met" if len(code_matches) > 3 else ("Partially Met" if code_matches else "Unbuilt / Deferred")
        if status in ["Fully Met", "Partially Met"]:
            total_verified_built += 1
        else:
            total_verified_gaps += 1

        ch_missing_details.append({
            "heading": heading,
            "sec_num": sec_num,
            "sec_title": sec_title,
            "body_snippet": body[:200].replace("\n", " ") + ("..." if len(body) > 200 else ""),
            "code_matches": code_matches[:3],
            "status": status
        })

    chapter_updates[ch_num] = {
        "spec_file": os.path.basename(spec_path),
        "obs_file": os.path.basename(obs_path),
        "obs_path": obs_path,
        "missing_details": ch_missing_details
    }

# Save findings JSON
with open(os.path.join(artifact_dir, "scratch/deep_audit_results.json"), "w", encoding="utf-8") as f:
    json.dump(chapter_updates, f, indent=2)

print(f"Deep audit completed. Total missing sections analyzed: {total_missing_sections}")
print(f"Verified built/partially met: {total_verified_built}, Verified unbuilt gaps: {total_verified_gaps}")
