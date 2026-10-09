import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../dist");
let count = 0;
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, e.name);
    if (e.isDirectory()) {
      await walk(path);
      continue;
    }
    count++;
    if (e.name.endsWith(".js"))
      execFileSync(process.execPath, ["--check", path]);
    if (!/\.(html|css|js|svg|txt)$/.test(e.name)) continue;
    const b = await readFile(path);
    assert(!(b[0] === 239 && b[1] === 187 && b[2] === 191), "BOM");
    if (!e.name.endsWith(".html")) continue;
    const h = b.toString("utf8");
    assert(
      h.includes('lang="ko"') &&
        h.includes("connect-src 'self'") &&
        h.includes("frame-src 'none'"),
    );
    assert(!/\son\w+=|<iframe\b/i.test(h));
    const ids = [...h.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const [, ref] of h.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(https?:|data:)/.test(ref)) continue;
      const target = resolve(
        dirname(path),
        ref.endsWith("/") ? ref + "index.html" : ref,
      );
      assert(target.startsWith(root + sep));
      await readFile(target);
    }
  }
}
await walk(root);
for (const file of ["app.js", "audio.js", "model.js", "notation.js"])
  assert(
    !/document\.cookie|web-lab-progress-v1|sessionStorage|fetch\s*\(\s*['"]https?:/.test(
      await readFile(resolve(root, "src", file), "utf8"),
    ),
  );
console.log(
  `PASS ${count} static files, syntax/assets/CSP and private project boundary.`,
);
