const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createWhopCheckout } = require("./lib/whop");

const root = __dirname;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/checkout") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "Method not allowed." });
    }

    let body = "";
    for await (const chunk of request) body += chunk;
    if (body.length > 4096) return sendJson(response, 413, { error: "Request is too large." });
    let input;
    try {
      input = JSON.parse(body || "{}");
    } catch {
      return sendJson(response, 400, { error: "Invalid JSON request." });
    }
    const email = typeof input.email === "string" ? input.email.trim() : "";
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return sendJson(response, 400, { error: "Enter a valid email address." });
    }
    try {
      return sendJson(response, 200, await createWhopCheckout(email));
    } catch (error) {
      console.error("Whop checkout error:", error.message);
      return sendJson(response, 502, { error: "Checkout could not be created. Please try again later." });
    }
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) return sendJson(response, 403, { error: "Forbidden." });
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(response, 404, { error: "Not found." });
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    response.end(content);
  });
});

server.listen(Number(process.env.PORT || 3000), () => {
  console.log(`AI Money is available at http://localhost:${process.env.PORT || 3000}`);
});
