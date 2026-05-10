import http from "node:http";

const targetRaw = process.env.CHORD_MINI_TARGET || "http://127.0.0.1:5002";
const target = new URL(targetRaw);
const host = process.env.CHORD_MINI_PROXY_HOST || "127.0.0.1";
const port = Number(process.env.CHORD_MINI_PROXY_PORT || 5003);

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url || !req.url.startsWith("/")) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid request URL" }));
    return;
  }

  const path = req.url;
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  delete forwardHeaders.origin;
  delete forwardHeaders.referer;

  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: req.method,
      path,
      headers: forwardHeaders
    },
    (upstreamRes) => {
      setCorsHeaders(res);
      const headers = { ...upstreamRes.headers };
      delete headers["access-control-allow-origin"];
      delete headers["access-control-allow-credentials"];
      res.writeHead(upstreamRes.statusCode || 502, headers);
      upstreamRes.pipe(res);
    }
  );

  upstream.on("error", (error) => {
    setCorsHeaders(res);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Proxy upstream request failed",
        details: error.message,
        target: `${target.origin}${path}`
      })
    );
  });

  req.pipe(upstream);
});

server.listen(port, host, () => {
  console.log(`[ChordMini Proxy] Listening on http://${host}:${port}`);
  console.log(`[ChordMini Proxy] Forwarding to ${target.origin}`);
});
