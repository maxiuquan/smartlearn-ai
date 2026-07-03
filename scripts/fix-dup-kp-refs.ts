import * as fs from 'fs';

const filePath = 'data/questions/math-full.json';
let content = fs.readFileSync(filePath, 'utf-8');

const replacements: [string, string][] = [
  ['"kp-2-2-14"', '"kp-2-2-7"'],
  ['"kp-2-2-15"', '"kp-2-2-8"'],
];

for (const [oldId, newId] of replacements) {
  const regex = new RegExp(oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const count = (content.match(regex) || []).length;
  content = content.replace(regex, newId);
  console.log(`  ${oldId} → ${newId}: ${count} 处替换`);
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log('\n完成！');