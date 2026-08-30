const fs = require('fs');
const path = require('path');

const dirPath = path.join(__dirname, 'src');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Replace indigo colors with teal
  if (content.includes('#818cf8')) {
    content = content.replace(/#818cf8/g, '#0d8a73');
    changed = true;
  }
  if (content.includes('rgba(99, 102, 241')) {
    content = content.replace(/rgba\(99, 102, 241/g, 'rgba(13, 138, 115');
    changed = true;
  }

  // Replace emerald colors with teal/dark emerald
  if (content.includes('#34d399')) {
    content = content.replace(/#34d399/g, '#059669');
    changed = true;
  }
  if (content.includes('rgba(16, 185, 129')) {
    content = content.replace(/rgba\(16, 185, 129/g, 'rgba(5, 150, 105');
    changed = true;
  }
  
  // Replace glass-card with card
  if (content.includes('glass-card')) {
    content = content.replace(/glass-card/g, 'card');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      replaceInFile(fullPath);
    }
  });
}

traverseDir(dirPath);
console.log('Color replacement complete.');
