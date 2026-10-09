import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", "output"].includes(e.name)) continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (
      /\.(md|json|js|mjs|css|html|svg|yml|txt)$/.test(e.name) ||
      e.name.startsWith(".git")
    ) {
      const b = await readFile(p);
      let s = b.toString("utf8").replace(/^\uFEFF/, "");
      if (e.name.endsWith(".txt")) s = s.replace(/[ \t]+(?=\r?$)/gm, "");
      s = s.replace(/\r?\n/g, "\r\n");
      if (!Buffer.from(s).equals(b)) await writeFile(p, s, "utf8");
    }
  }
}
await walk(root);
console.log("UTF-8 / CRLF normalized");
