const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('git diff --name-only --diff-filter=U').toString().trim().split('\n');
let out = '';

for (const f of files) {
  if (!f) continue;
  const c = fs.readFileSync(f, 'utf8');
  let inConflict = false;
  let block = '';
  const lines = c.split('\n');
  for(let i=0; i<lines.length; i++) {
    if (lines[i].startsWith('<<<<<<<')) {
      inConflict = true;
      block = `\n\n### ${f}:${i}\n${lines[i]}\n`;
    } else if (inConflict) {
      block += lines[i] + '\n';
      if (lines[i].startsWith('>>>>>>>')) {
        inConflict = false;
        out += block;
      }
    }
  }
}
fs.writeFileSync('conflicts_summary.md', out, 'utf8');
console.log('Wrote conflicts_summary.md');
