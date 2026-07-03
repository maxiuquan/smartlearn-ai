/**
 * 种子脚本：导入完整数学题库到数据库
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface QuestionData {
  id: string;
  type: string;
  difficulty: number;
  chapter: string;
  section: string;
  knowledge_points: string[];
  title: string;
  content: string;
  answer: string;
  solution: string;
  hints: string[];
  tags: string[];
  options?: string[];
  source: string;
  year: number | null;
}

async function main() {
  console.log('=== 导入数学题库 ===');
  
  // 读取 math-full.json
  const mathPath = path.join(__dirname, '..', '..', 'data', 'questions', 'math-full.json');
  const mathData = JSON.parse(fs.readFileSync(mathPath, 'utf-8'));
  const questions: QuestionData[] = Array.isArray(mathData) ? mathData : mathData.questions;
  
  console.log(`共 ${questions.length} 道数学题需要导入`);
  
  // 先获取所有知识点
  const allKps = await prisma.knowledgePoint.findMany({
    where: { subject: 'math' },
  });
  const kpMap = new Map<string, number>();
  for (const kp of allKps) {
    kpMap.set(kp.name, kp.id);
    // 也按章节映射
    kpMap.set(kp.chapter, kp.id);
  }
  
  console.log(`数据库中有 ${allKps.length} 个知识点`);
  
  // 批量导入
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const q of questions) {
    try {
      // 找到匹配的知识点
      const kpIds: number[] = [];
      for (const kpId of q.knowledge_points) {
        // 直接使用知识点 ID 或按名称查找
        const found = allKps.find(k => k.id === kpMap.get(kpId) || k.name === kpId);
        if (found) {
          kpIds.push(found.id);
        }
      }
      
      // 如果没有匹配的知识点，使用同章节的知识点
      if (kpIds.length === 0) {
        const chapterKps = allKps.filter(k => k.chapter === q.chapter || k.category === q.chapter);
        if (chapterKps.length > 0) {
          kpIds.push(chapterKps[Math.floor(Math.random() * chapterKps.length)].id);
        }
      }
      
      // 如果还是没有，使用第一个知识点
      if (kpIds.length === 0 && allKps.length > 0) {
        kpIds.push(allKps[Math.floor(Math.random() * allKps.length)].id);
      }
      
      // 创建题目
      await prisma.question.create({
        data: {
          content: q.content,
          questionType: q.type,
          options: q.options ? JSON.stringify(q.options) : null,
          answer: q.answer,
          solution: q.solution,
          difficulty: q.difficulty,
          source: q.source,
          knowledgePoints: {
            create: kpIds.map(id => ({ knowledgePointId: id })),
          },
        },
      });
      
      imported++;
      if (imported % 100 === 0) {
        console.log(`已导入 ${imported}/${questions.length} 道题...`);
      }
    } catch (e: any) {
      if (e.code === 'P2002') {
        skipped++;
      } else {
        errors++;
        if (errors <= 5) {
          console.error(`导入失败: ${q.title}`, e.message?.substring(0, 100));
        }
      }
    }
  }
  
  console.log(`\n导入完成: 成功 ${imported} 道, 跳过 ${skipped} 道, 失败 ${errors} 道`);
  
  const total = await prisma.question.count();
  console.log(`数据库总题数: ${total}`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('导入失败:', e);
  process.exit(1);
});