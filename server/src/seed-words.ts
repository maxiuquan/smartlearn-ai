import { PrismaClient } from '@prisma/client';
import { CET4_CORE_WORDS } from './data/english-words-cet4';
import { CET6_ADVANCED_WORDS, KAOYAN_ESSENTIAL_WORDS } from './data/english-words';

const prisma = new PrismaClient();

async function main() {
  // 先删除所有英语单词
  const deleted = await prisma.word.deleteMany({
    where: { category: { in: ['CET4核心词', 'CET6进阶词', '考研必备词', '考研熟词僻义'] } }
  });
  console.log(`已删除 ${deleted.count} 个旧单词`);
  
  // 按顺序导入：CET6、考研先导入，CET4最后导入（确保CET4分类优先）
  const allWords = [...CET6_ADVANCED_WORDS, ...KAOYAN_ESSENTIAL_WORDS, ...CET4_CORE_WORDS];
  console.log(`开始导入 ${allWords.length} 个英语单词 (CET6: ${CET6_ADVANCED_WORDS.length}, 考研: ${KAOYAN_ESSENTIAL_WORDS.length}, CET4: ${CET4_CORE_WORDS.length})...`);
  
  let count = 0;
  let errors = 0;
  for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i];
    try {
      await prisma.word.upsert({ where: { word: w.word }, update: w, create: w });
      count++;
      if (count % 500 === 0) {
        console.log(`已导入 ${count}/${allWords.length} 个单词...`);
      }
    } catch (e) {
      errors++;
      console.error(`导入失败: ${w.word}`, String(e).substring(0, 100));
    }
  }
  
  console.log(`导入完成！共 ${count} 个英语单词，失败 ${errors} 个`);
  
  // 验证
  const total = await prisma.word.count();
  const cet4 = await prisma.word.count({ where: { category: 'CET4核心词' } });
  const cet6 = await prisma.word.count({ where: { category: 'CET6进阶词' } });
  const kaoyan = await prisma.word.count({ where: { category: '考研必备词' } });
  
  console.log(`验证 - 总计: ${total}, CET4: ${cet4}, CET6: ${cet6}, 考研: ${kaoyan}`);
  
  await prisma.$disconnect();
}

main().catch((e) => { console.error('导入失败:', e); process.exit(1); });