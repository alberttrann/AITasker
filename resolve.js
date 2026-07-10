const fs = require('fs');
const { execSync } = require('child_process');

function getConflictedFiles() {
  const output = execSync('git diff --name-only --diff-filter=U').toString();
  return output.split('\n').map(l => l.trim()).filter(l => l);
}

function resolveFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('<<<<<<< HEAD')) return;

  console.log('Resolving:', filePath);
  
  const lines = content.split('\n');
  const result = [];
  let inConflict = false;
  let headBlock = [];
  let theirsBlock = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('<<<<<<< HEAD')) {
      inConflict = true;
      currentBlock = headBlock;
    } else if (line.startsWith('=======')) {
      currentBlock = theirsBlock;
    } else if (line.startsWith('>>>>>>>')) {
      inConflict = false;
      const headIsClosing = headBlock.length === 1 && headBlock[0].trim() === '}';
      const theirsIsClosing = theirsBlock.length === 1 && theirsBlock[0].trim() === '}';
      
      if (headIsClosing && !theirsIsClosing) {
        result.push(...theirsBlock);
        result.push(...headBlock);
      } else if (theirsIsClosing && !headIsClosing) {
        result.push(...headBlock);
        result.push(...theirsBlock);
      } else {
        result.push(...headBlock);
        result.push(...theirsBlock);
      }
      
      headBlock = [];
      theirsBlock = [];
      currentBlock = null;
    } else {
      if (inConflict) {
        currentBlock.push(line);
      } else {
        result.push(line);
      }
    }
  }

  // Very basic duplicate import removal
  const finalResult = [];
  const importSet = new Set();
  for (const line of result) {
    if (line.startsWith('import ') && line.includes(' from ')) {
      if (!importSet.has(line.trim())) {
        importSet.add(line.trim());
        finalResult.push(line);
      }
    } else {
      finalResult.push(line);
    }
  }

  fs.writeFileSync(filePath, finalResult.join('\n'), 'utf8');
}

const files = getConflictedFiles();
for (const file of files) {
  resolveFile(file);
}
console.log('Done resolving by accepting BOTH. Please run `npm run build` to check syntax errors.');
