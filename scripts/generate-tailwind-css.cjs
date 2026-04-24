const fs = require('fs');
const path = require('path');
const { compile } = require('../node_modules/.pnpm/node_modules/@tailwindcss/node/dist/index.js');

const ROOT = process.cwd();
const SOURCE_FILE = path.join(ROOT, 'app', 'globals.source.css');
const OUTPUT_FILE = path.join(ROOT, 'app', 'globals.css');
const SOURCE_DIRS = [
  path.join(ROOT, 'app'),
  path.join(ROOT, 'components'),
  path.join(ROOT, 'lib'),
];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mdx']);
const STRING_LITERAL_RE = /(["'])(?:\\.|(?!\1)[^\\])*\1|`(?:\\.|[^\\`])*`/gs;
const TEMPLATE_EXPR_RE = /\$\{[^{}]*\}/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeCandidate(rawToken) {
  const token = rawToken
    .trim()
    .replace(/^[,;]+|[,;]+$/g, '')
    .replace(/^[(){}]+|[(){}]+$/g, '');

  if (!token || token.length > 160) return null;
  if (token.includes('://') || token.includes('@') || token.includes('=')) return null;
  if (!/[A-Za-z]/.test(token) && !token.includes('[') && !token.includes('-')) return null;

  return token;
}

function collectCandidates() {
  const candidates = new Set();

  for (const dir of SOURCE_DIRS) {
    for (const file of walk(dir)) {
      const contents = fs.readFileSync(file, 'utf8');
      const matches = contents.match(STRING_LITERAL_RE) ?? [];

      for (const match of matches) {
        let value = match.slice(1, -1);

        if (match.startsWith('`')) {
          value = value.replace(TEMPLATE_EXPR_RE, ' ');
        }

        for (const piece of value.split(/\s+/)) {
          const candidate = normalizeCandidate(piece);

          if (candidate) {
            candidates.add(candidate);
          }
        }
      }
    }
  }

  return [...candidates].sort();
}

async function main() {
  const sourceCss = fs.readFileSync(SOURCE_FILE, 'utf8');
  const tailwind = await compile(sourceCss, {
    base: ROOT,
    from: SOURCE_FILE,
    onDependency() {},
  });

  const css = tailwind.build(collectCandidates());

  fs.writeFileSync(OUTPUT_FILE, `${css}\n`);
}

main().catch(error => {
  console.error('[generate-tailwind-css] failed');
  console.error(error);
  process.exit(1);
});
