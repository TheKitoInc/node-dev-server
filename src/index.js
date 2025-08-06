/*
 * node-dev-server
 * Copyright(c) 2025 TheKitoInc
 * MIT Licensed
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, '../dist');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const reloadScript = `
<script>
  (() => {
    const ws = new WebSocket("ws://localhost:${PORT}");
    ws.onmessage = (msg) => {
      if (msg.data === "reload") location.reload();
    };
  })();
</script>`;

// Middleware to serve HTML and inject reload script
app.use((req, res, next) => {
  let filePath = path.join(DIST_DIR, req.url.split('?')[0]);

  console.log('🔍 Initial file path:', filePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    // If the request is for a folder, serve index.html in that folder
    filePath = path.join(filePath, 'index.html');
    console.log('🔍 Serving index.html for directory:', filePath);
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
    console.log('🔍 Serving fallback index.html:', filePath);
  }

  if (!filePath.endsWith('.html')) {
    // If the request is not for an HTML file, continue to the next middleware
    console.log('🔍 Not an HTML file, skipping injection:', filePath);
    return next();
  }

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    return res.status(404).send('Not Found');
  }

  console.log('🔍 Serving HTML file:', filePath);
  let html = fs.readFileSync(filePath, 'utf8');

  // Inject the reload script before </body>
  html = html.replace(/<\/body>/i, `${reloadScript}</body>`);
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

// Static middleware for everything else (CSS, JS, images)
app.use(express.static(DIST_DIR));

// WebSocket connections
wss.on('connection', ws => {
  console.log('🔌 Browser connected for live reload');
});

// Watch dist directory and notify clients on changes
chokidar.watch(DIST_DIR).on('change', file => {
  console.log('📦 Changed:', file);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send('reload');
    }
  });
});

server.listen(PORT, () => {
  console.log(
    `🚀 Dev server running at http://localhost:${server.address().port}`
  );
});
