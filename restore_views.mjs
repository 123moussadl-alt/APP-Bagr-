import fs from 'fs';
import path from 'path';
const viewsDir = 'C:\\Users\\HP\\Desktop\\App Bagré\\src\\views';
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove LT constant
  content = content.replace("const LT = '<';\n", "");
  
  // Replace ${LT} with <
  content = content.replace(/\$\{LT\}/g, '<');
  
  fs.writeFileSync(filePath, content);
  console.log('Restored:', file);
});