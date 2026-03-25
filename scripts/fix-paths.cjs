const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '../out');

function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const htmlFiles = findHtmlFiles(outDir);
htmlFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/href="\/_next\/static/g, 'href="app://_next/static');
  content = content.replace(/src="\/_next\/static/g, 'src="app://_next/static');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✅ Patched ${file}`);
});
