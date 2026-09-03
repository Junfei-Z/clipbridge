import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../web/", import.meta.url));
const port = Number.parseInt(process.env.CLIPBRIDGE_WEB_PORT || "4173", 10);
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"]
]);

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://127.0.0.1");
  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/") {
    response.writeHead(302, { Location: "/clipbridge/" });
    response.end();
    return;
  }
  if (!pathname.startsWith("/clipbridge/")) {
    response.writeHead(404).end("Not found");
    return;
  }

  pathname = pathname.slice("/clipbridge/".length) || "index.html";
  const target = normalize(join(root, pathname));
  if (relative(root, target).startsWith("..") || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes.get(extname(target)) || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(target).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ClipBridge Web: http://127.0.0.1:${port}/clipbridge/`);
});

function stop() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
