import "dotenv/config";
import pool, { query } from "./src/utils/db.js";
const { rows: caps } = await query("SELECT code FROM ontology_concepts WHERE concept_type = 'capability-name' AND is_active = true ORDER BY code");
console.log("capability-name codes:", caps.map(r => r.code));
const { rows: tmpl } = await query("SELECT code FROM ontology_concepts WHERE concept_type = 'template-categories' AND is_active = true ORDER BY code");
console.log("template-categories codes:", tmpl.map(r => r.code));
await pool.end();
