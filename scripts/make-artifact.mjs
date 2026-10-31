// Turns dist-single/index.html into a body-only page for hosts that supply their own
// <html>/<head>/<body> wrapper (for example a claude.ai Artifact). Usage: node scripts/make-artifact.mjs <out>
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8');
const head = src.slice(src.indexOf('<head>') + 6, src.indexOf('</head>'));
const body = src.slice(src.indexOf('<body>') + 6, src.lastIndexOf('</body>'));
const keepHead = head.replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
// Put title/meta/links first, then the root element, then scripts and styles.
const titleEtc = keepHead.match(/<(title|meta|link)\b[^>]*>(?:[^<]*<\/title>)?/gi).join('\n');
const rest = keepHead.replace(/<(title|meta|link)\b[^>]*>(?:[^<]*<\/title>)?/gi, '');
writeFileSync(process.argv[2] || 'dist-single/nursepath-artifact.html', `${titleEtc}\n${body.trim()}\n${rest.trim()}\n`);
console.log('written');
