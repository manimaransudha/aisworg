import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DOCS_ROOT = path.resolve(__dirname, "../../docs");

export interface DocEntry {
  name: string;
  path: string;
}

export function listDocsDir(absDir: string, relDir: string): { folders: DocEntry[]; files: DocEntry[] } {
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const folders: DocEntry[] = [];
  const files: DocEntry[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      folders.push({ name: entry.name, path: path.posix.join(relDir, entry.name) });
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push({ name: entry.name.replace(/\.md$/i, ""), path: path.posix.join(relDir, entry.name) });
    }
  }
  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { folders, files };
}

export function listTopLevelDocFolders(): DocEntry[] {
  return listDocsDir(DOCS_ROOT, "").folders;
}
