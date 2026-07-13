import fs from 'fs';
import path from 'path';

const filePath = 'C:/Users/Ala/.gemini/antigravity/brain/cd055694-8359-4e73-becd-a3cb6946ccb4/.system_generated/steps/341/content.md';
const content = fs.readFileSync(filePath, 'utf8');

// Find all HTML tables
const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
let match;
let tableIndex = 0;

while ((match = tableRegex.exec(content)) !== null) {
  const tableContent = match[1];
  console.log(`Table ${tableIndex}: length=${tableContent.length}, preview=${tableContent.substring(0, 150).replace(/\s+/g, ' ')}`);
  tableIndex++;
}
