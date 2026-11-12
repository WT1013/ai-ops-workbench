/**
 * 本地预览：把 dist/ 起成 http 服务（不要用 file:// 打开，浏览器会拦 SDK 请求）
 *   node scripts/serve.cjs 8790
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
const port = Number(process.argv[2] || 8790);

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!path.resolve(f).startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port + '/  （Ctrl+C 结束）'));
