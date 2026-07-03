/**
 * 种子脚本：导入完整英语题库到数据库
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface QuestionData {
  id: string;
  type: string;
  difficulty: number;
  category: string;
  section: string;
  knowledge_points: string[];
  title: string;
  content: string;
  answer: string;
  solution: string;
  options?: string[];
  tags: string[];
  source: string;
  year: number | null;
}

async function main() {
  console.log('=== 导入英语题库 ===');
  
  const englishPath = path.join(__dirname, '..', '..', 'data', 'questions', 'english-full.json');
  if (!fs.existsSync(englishPath)) {
    console.log('英语题库文件不存在，跳过导入');
    await prisma.$disconnect();
    return;
  }
  
  const englishData = JSON.parse(fs.readFileSync(englishPath, 'utf-8'));
  const questions: QuestionData[] = Array.isArray(englishData) ? englishData : englishData.questions;
  
  console.log(`共 ${questions.length} 道英语题需要导入`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const q of questions) {
    try {
      // 为英语题创建或获取知识点
      const kpNames = q.knowledge_points || [];
      const kpIds: number[] = [];
      
      for (const kpName of kpNames) {
        let kp = await prisma.knowledgePoint.findFirst({
          where: { name: kpName, subject: 'english' },
        });
        
        if (!kp) {
          kp = await prisma.knowledgePoint.create({
            data: {
              name: kpName,
              subject: 'english',
              category: q.category || '英语',
              chapter: q.section || '综合',
              description: `英语知识点: ${kpName}`,
              difficulty: q.difficulty || 1,
              examType: 'all',
            },
          });
        }
        
        kpIds.push(kp.id);
      }
      
      await prisma.question.create({
        data: {
          content: q.content,
          questionType: q.type,
          options: q.options ? JSON.stringify(q.options) : null,
          answer: q.answer,
          solution: q.solution || '',
          difficulty: q.difficulty || 1,
          source: q.source || '英语题库',
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