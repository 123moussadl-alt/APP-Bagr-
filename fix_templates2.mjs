import fs from 'fs';
import path from 'path';
const viewsDir = 'C:\\Users\\HP\\Desktop\\App Bagré\\src\\views';
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Add LT constant after the first export/function
  // Replace all \x3C with ${LT}
  content = content.replace(/\\x3C/g, '${LT}');
  
  // Add const LT = '<'; at the top of the function body
  // Find the first export function and add after its opening brace
  content = content.replace(/(export function \w+\([^)]*\)\s*\{)/, '$1\n  const LT = \'<\\x3C\';');
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed:', file);
});