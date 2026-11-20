// Copies the game into public/index.html as a complete web page.
// Usage: node build.js path/to/isole-sospese.html   (default: ../isole-sospese.html)
const fs = require('fs'), path = require('path');
const src = process.argv[2] || path.join(__dirname, '..', 'isole-sospese.html');
const game = fs.readFileSync(src, 'utf8').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '');
const page = '<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + game + '\n</html>\n';
fs.mkdirSync(path.join(__dirname, 'public'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'public', 'index.html'), page);
console.log('public/index.html aggiornato');
