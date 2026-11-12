// Cloudflare Pages build: copies the public site into dist/.
// Run by Pages as the build command (node build.js) with output directory "dist".
// It publishes everything in the repo EXCEPT the files listed below, so a new page,
// image, script or stylesheet is picked up automatically with no change here.
// The contact form function lives in functions/ and is built separately by Pages.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

// Top-level names that are not part of the public site.
// Every dot-file or dot-folder is also skipped (.env, .dev.vars, .git, .wrangler ...), except .well-known.
const SKIP = new Set([
  'node_modules', 'dist', 'functions', 'api',
  'package.json', 'package-lock.json', 'README.md', 'build.js',
]);
const skipped = (name) => SKIP.has(name) || (name.startsWith('.') && name !== '.well-known');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) copy(path.join(src, entry), path.join(dest, entry));
  } else {
    fs.copyFileSync(src, dest);
    count += 1;
  }
}

for (const entry of fs.readdirSync(ROOT)) {
  if (skipped(entry)) continue;
  copy(path.join(ROOT, entry), path.join(OUT, entry));
}
console.log(`Copied ${count} files to dist/`);
