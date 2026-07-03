/**
 * 修复 math-full.json 中的孤立知识点引用
 * 将不存在的知识点ID映射到正确的现有ID
 */
import * as fs from 'fs';

const filePath = 'data/questions/math-full.json';

const replacements: Record<string, string> = {
  // 定积分的应用 → math.json ch3-s4
  '"kp-5-5-1"': '"kp-3-4-1"',  // 平面图形的面积
  '"kp-5-5-2"': '"kp-3-4-2"',  // 旋转体的体积
  // 幂级数求和 → math.json ch7-s2
  '"kp-7-2-6"': '"kp-7-2-4"',  // 幂级数的分析性质（逐项求导/积分）
  // 矩阵对角化 → linear-algebra.json la-ch5-s2
  '"la-kp-5-3-1"': '"la-kp-5-2-2"', // 相似对角化
  // 协方差 → probability.json prob-ch4-s3
  '"prob-kp-2-5-1"': '"prob-kp-4-3-1"', // 协方差
};

let content = fs.readFileSync(filePath, 'utf-8');
let totalReplacements = 0;

for (const [oldId, newId] of Object.entries(replacements)) {
  const regex = new RegExp(oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = content.match(regex);
  const count = matches ? matches.length : 0;
  content = content.replace(regex, newId);
  if (count > 0) {
    console.log(`  ${oldId} → ${newId}: ${count} 处替换`);
  }
  totalReplacements += count;
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log(`\n完成！共修复 ${totalReplacements} 处孤立知识点引用。`);