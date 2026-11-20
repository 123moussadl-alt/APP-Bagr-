import fs from 'fs';
import path from 'path';
const viewsDir = 'C:\\Users\\HP\\Desktop\\App Bagré\\src\\views';
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix single-quoted strings that have escaped ${LT}
  content = content.replaceAll('return \'\\${LT}', "return '<");
  content = content.replaceAll('\\${LT}/div>\'', '</div>\'');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed:', file);
});