import fs from 'fs';
import path from 'path';
const viewsDir = 'C:\\Users\\HP\\Desktop\\App Bagré\\src\\views';
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find all backticks
  const backtickPositions = [];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '`') {
      backtickPositions.push(i);
    }
  }
  console.log(`${file}: ${backtickPositions.length} backticks`);
  
  // Replace < with \x3C inside template literals
  let result = '';
  let inTemplate = false;
  let lastEnd = 0;
  
  for (let i = 0; i < backtickPositions.length; i += 2) {
    const start = backtickPositions[i];
    const end = backtickPositions[i + 1];
    
    if (end === undefined) break;
    
    // Add content before template
    result += content.slice(lastEnd, start + 1);
    
    // Process template content
    const templateContent = content.slice(start + 1, end);
    const processed = templateContent.replace(/</g, '\\x3C');
    result += processed;
    
    // Add closing backtick
    result += '`';
    
    lastEnd = end + 1;
  }
  
  // Add remaining content
  result += content.slice(lastEnd);
  
  fs.writeFileSync(filePath, result);
  console.log('Fixed:', file);
});