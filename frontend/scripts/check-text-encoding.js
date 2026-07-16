const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIRS = ['app', 'components', 'lib', 'scripts'];
const FILE_RE = /\.(ts|tsx|js|jsx|md)$/i;
const BAD_PATTERNS = [
  /\u00c3[\u0080-\u00bf]/,
  /\u00c2[\u0080-\u00bf]/,
  /[\u00c4\u00c5\u00c6\u00d0][\u0080-\u00ff\u0100-\u017f]/,
  /\u00f0\u0178/,
  /\u00e2\u20ac/,
  /\u00ef\u00bf\u00bd/,
  /\u001b/,
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (FILE_RE.test(entry.name)) out.push(full);
  }
  return out;
}

const files = TARGET_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
const findings = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (BAD_PATTERNS.some((pattern) => pattern.test(line))) {
      findings.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (findings.length > 0) {
  console.error('Phát hiện chuỗi có dấu hiệu lỗi mã hóa tiếng Việt:\n');
  findings.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('OK - Không phát hiện chuỗi lỗi mã hóa tiếng Việt trong app/components/lib/scripts.');
