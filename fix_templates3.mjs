import fs from 'fs';
import path from 'path';
const viewsDir = 'C:\\Users\\HP\\Desktop\\App Bagré\\src\\views';
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the LT constant
  content = content.replace("const LT = '<\\x3C';", "const LT = '<';");
  
  // Fix escaped ${LT} in single-quoted strings
  content = content.replace(/\\\\\\${LT}/g, '<');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed:', file);
});