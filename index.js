var http = require("http");
var fs = require("fs");

var server = http.createServer((req, res) => {
  if (req.url == "/") {
    fs.readFile("index.html", (err, html) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("Sunucu hatası: index.html okunamadı.");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write(html);
      res.end();
    });
  }

  else if (req.url === "/urunler") {
    fs.readFile("urunler.html", (err, html) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("Sunucu hatası: urunler.html okunamadı.");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write(html);
      res.end();
    });
  }

  else {
    fs.readFile("404.html", (err, html) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("404 - Sayfa bulunamadı.");
        return;
      }
      res.writeHead(404, { "Content-Type": "text/html" });
      res.write(html);
      res.end();
    });
  }
});

server.listen(3000, () => {
  console.log("Node.js server running at http://localhost:3000");
});
