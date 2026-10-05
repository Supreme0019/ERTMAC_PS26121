const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'validators');
fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith('.js')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('.uuid()')) {
    content = content.replace(/\.uuid\(\)/g, ".regex(/^[0-9a-fA-F-]{36}$/, 'Invalid UUID')");
    fs.writeFileSync(filePath, content);
    console.log('Updated:', file);
  }
});
