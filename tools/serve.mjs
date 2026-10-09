import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
const root = resolve(import.meta.dirname, "../dist"),
  port = Number(process.argv[2] ?? 0);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new RangeError("Invalid port");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".mp3": "audio/mpeg",
};
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost"),
        path = resolve(
          root,
          "." + decodeURIComponent(url.pathname),
          url.pathname.endsWith("/") ? "index.html" : "",
        );
      if (!path.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const bytes = await readFile(path);
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", function () {
    console.log(`Local: http://127.0.0.1:${this.address().port}/`);
  });
