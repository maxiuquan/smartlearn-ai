/**
 * 修复 math-full.json 中知识点引用ID格式
 * kp-prob-X-Y → prob-kp-X-Y-1
 * kp-la-X-Y → la-kp-X-Y-1
 */
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '..', 'data', 'questions', 'math-full.json');

const content = fs.readFileSync(filePath, 'utf-8');

// kp-prob-X-Y → prob-kp-X-Y-1
let fixed = content.replace(/"kp-prob-(\d+)-(\d+)"/g, (_, x, y) => `"prob-kp-${x}-${y}-1"`);

// kp-la-X-Y → la-kp-X-Y-1
fixed = fixed.replace(/"kp-la-(\d+)-(\d+)"/g, (_, x, y) => `"la-kp-${x}-${y}-1"`);

fs.writeFileSync(filePath, fixed, 'utf-8');

// Count replacements
const probCount = (content.match(/"kp-prob-/g) || []).length;
const laCount = (content.match(/"kp-la-/g) || []).length;
const totalFixed = probCount + laCount;

console.log(`[修复完成] math-full.json`);
console.log(`  kp-prob-* → prob-kp-*-1: ${probCount} 处`);
console.log(`  kp-la-* → la-kp-*-1: ${laCount} 处`);
console.log(`  总计修复: ${totalFixed} 处`);