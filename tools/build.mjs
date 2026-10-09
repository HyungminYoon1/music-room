import { build } from "esbuild";
import {
  mkdir,
  readdir,
  copyFile,
  readFile,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, "dist/vendor"), { recursive: true });
await mkdir(resolve(root, "dist/assets/licenses"), { recursive: true });
const result = await build({
  entryPoints: [resolve(root, "tools/vendor-entry.js")],
  outfile: resolve(root, "dist/vendor/music.js"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
  legalComments: "eof",
  metafile: true,
});
const names = new Set();
for (const path of Object.keys(result.metafile.inputs)) {
  const norm = path.replaceAll("\\", "/"),
    idx = norm.lastIndexOf("node_modules/");
  if (idx < 0) continue;
  const parts = norm.slice(idx + 13).split("/");
  names.add(parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
}
const licenseParts = [];
for (const name of [...names].sort()) {
  const dir = resolve(root, "node_modules", name),
    pkg = JSON.parse(await readFile(resolve(dir, "package.json"), "utf8")),
    files = (await readdir(dir)).filter((x) =>
      /^licen[sc]e(?:[.-]|$)|^copying(?:[.-]|$)/i.test(x),
    );
  if (!files.length) throw Error(`Missing bundled dependency license: ${name}`);
  for (const file of files)
    licenseParts.push(
      `${name} ${pkg.version} | ${pkg.license}\r\n${await readFile(resolve(dir, file), "utf8")}`,
    );
}
await writeFile(
  resolve(root, "dist/assets/licenses/third-party.txt"),
  licenseParts.join("\r\n\r\n----------------\r\n\r\n"),
  "utf8",
);
for (const name of ["vexflow", "jspdf"]) {
  const pkg = JSON.parse(
    await readFile(resolve(root, "node_modules", name, "package.json"), "utf8"),
  );
  const license = await readFile(
    resolve(root, "node_modules", name, "LICENSE"),
    "utf8",
  );
  await writeFile(
    resolve(root, "dist/assets/licenses", `${name}.txt`),
    `${name} ${pkg.version}\r\n${license}`,
    "utf8",
  );
}
console.log("Built pinned same-origin music vendor module and licenses.");
