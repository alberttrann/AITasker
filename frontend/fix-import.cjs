const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkDir(currentPath) {
  const files = fs.readdirSync(currentPath);
  for (const file of files) {
    const fullPath = path.join(currentPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fixFileImports(fullPath);
    }
  }
}

function fixFileImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replaces 'ui/Modal', 'ui/Button', or 'ui/Input' with their lowercase equivalents
  // This safely targets relative, absolute, and aliased imports.
  const replacements = [
    { regex: /ui\/Modal(?=["'])/g, replace: 'ui/modal' },
    { regex: /ui\/Button(?=["'])/g, replace: 'ui/button' },
    { regex: /ui\/Input(?=["'])/g, replace: 'ui/input' }
  ];

  for (const { regex, replace } of replacements) {
    if (regex.test(content)) {
      content = content.replace(regex, replace);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed imports in: ${path.relative(srcDir, filePath)}`);
  }
}

console.log('Scanning for case-mismatched UI imports (Modal, Button, Input)...');
try {
  walkDir(srcDir);
  console.log('Scan complete! Your imports are now lowercase-aligned.');
} catch (error) {
  console.error('An error occurred while scanning:', error.message);
}