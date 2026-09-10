self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate")
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kopi — Offline</title><body style="font-family:system-ui;padding:48px;background:#f7f8fa;color:#203e35"><h1>You’re offline</h1><p>Connect to the internet to view and update your books.</p><button onclick="location.reload()">Try again</button></body></html>',
            { headers: { "Content-Type": "text/html" } },
          ),
      ),
    );
});
