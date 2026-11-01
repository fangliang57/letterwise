// Author: Leon Fang
import { mkdir, copyFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
await mkdir(new URL('dist/', root), { recursive: true });
for (const filename of ['index.html', 'style.css', 'scoring.js', 'app.js', '.nojekyll']) {
  await copyFile(new URL(filename, root), new URL('dist/' + filename, root));
}
console.log('Letterwise static build ready: dist/');
