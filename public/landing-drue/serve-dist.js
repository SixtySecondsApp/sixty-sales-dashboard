#!/usr/bin/env node
/**
 * Simple HTTP server to serve the built landing page
 * Usage: node serve-dist.js [port]
 * Default port: 3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

const server = http.createServer((req, res) => {
  // Remove query string and normalize path
  let filePath = req.url.split('?')[0];
  
  // Default to index.html for root or non-file paths
  if (filePath === '/' || !path.extname(filePath)) {
    filePath = '/index.html';
  }
  
  const fullPath = path.join(DIST_DIR, filePath);
  
  // Security: prevent directory traversal
  if (!fullPath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // If file not found and it's not a root request, try index.html (for SPA routing)
      if (err.code === 'ENOENT' && filePath !== '/index.html') {
        const indexPath = path.join(DIST_DIR, 'index.html');
        fs.readFile(indexPath, (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data2);
          }
        });
      } else {
        res.writeHead(404);
        res.end('File not found');
      }
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Landing page server running at:`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`📦 Serving files from: ${DIST_DIR}\n`);
  console.log(`Press Ctrl+C to stop the server\n`);
});

