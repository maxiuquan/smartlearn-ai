/**
 * 题目上传接口 - 支持标准格式批量导入
 * POST /api/questions/upload
 * 
 * 标准格式：
 * {
 *   "subject": "math" | "english",
 *   "questions": [
 *     {
 *       "type": "choice" | "fill_in" | "calculation" | "proof",
 *       "difficulty": 1-5,
 *       "chapter": "章节名",
 *       "section": "小节名",
 *       "knowledge_points": ["kp-id-1", "kp-id-2"],
 *       "title": "题目标题",
 *       "content": "题目内容（支持 LaTeX $...$）",
 *       "answer": "正确答案",
 *       "solution": "解析",
 *       "hints": ["提示1", "提示2"],
 *       "tags": ["标签1", "标签2"],
 *       "options": ["选项A", "选项B", "选项C", "选项D"],  // 选择题必填
 *       "source": "来源",
 *       "year": 2024
 *     }
 *   ]
 * }
 */
import { Router } from 'express';
import { prisma } from '../db';

export const questionUploadRoutes = Router();

// 上传题目
questionUploadRoutes.post('/upload', async (req, res) => {
  try {
    const { subject, questions } = req.body as {
      subject: string;
      questions: Array<{
        type: string;
        difficulty: number;
        chapter: string;
        section?: string;
        knowledge_points?: string[];
        title?: string;
        content: string;
        answer: string;
        solution?: string;
        hints?: string[];
        tags?: string[];
        options?: string[];
        source?: string;
        year?: number;
      }>;
    };

    if (!subject || !questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: '缺少必要参数 subject 和 questions 数组' });
    }

    if (questions.length === 0) {
      return res.status(400).json({ error: 'questions 数组不能为空' });
    }

    if (questions.length > 1000) {
      return res.status(400).json({ error: '单次最多上传 1000 道题' });
    }

    // 获取知识点
    const allKps = await prisma.knowledgePoint.findMany({
      where: subject === 'english' ? { subject: 'english' } : { subject: 'math' },
    });

    const results = { imported: 0, skipped: 0, errors: 0, details: [] as string[] };

    for (const q of questions) {
      try {
        // 验证必填字段
        if (!q.content || !q.answer) {
          results.errors++;
          results.details.push(`缺少 content 或 answer`);
          continue;
        }

        if (q.type === 'choice' && (!q.options || q.options.length < 2)) {
          results.errors++;
          results.details.push(`选择题需要至少 2 个选项`);
          continue;
        }

        // 找到匹配的知识点
        const kpIds: number[] = [];
        if (q.knowledge_points) {
          for (const kpId of q.knowledge_points) {
            const found = allKps.find(k => k.id === Number(kpId) || k.name === kpId);
            if (found) kpIds.push(found.id);
          }
        }
        // 如果没有匹配，按章节查找
        if (kpIds.length === 0 && q.chapter) {
          const chapterKps = allKps.filter(k => k.chapter === q.chapter || k.category === q.chapter);
          for (const k of chapterKps.slice(0, 3)) {
            kpIds.push(k.id);
          }
        }

        await prisma.question.create({
          data: {
            content: q.content,
            questionType: q.type || 'calculation',
            options: q.options ? JSON.stringify(q.options) : null,
            answer: q.answer,
            solution: q.solution || '',
            difficulty: q.difficulty || 1,
            source: q.source || '用户上传',
            knowledgePoints: kpIds.length > 0
              ? { create: kpIds.map(id => ({ knowledgePointId: id })) }
              : undefined,
          },
        });

        results.imported++;
      } catch (e: any) {
        if (e.code === 'P2002') {
          results.skipped++;
        } else {
          results.errors++;
          results.details.push(e.message?.substring(0, 100));
        }
      }
    }

    res.json({
      success: true,
      ...results,
      message: `成功导入 ${results.imported} 道题，跳过 ${results.skipped} 道，失败 ${results.errors} 道`,
    });
  } catch (error) {
    res.status(500).json({ error: '上传题目失败' });
  }
});

// 获取标准格式模板
questionUploadRoutes.get('/template', (_req, res) => {
  res.json({
    template: {
      subject: 'math',
      questions: [
        {
          type: 'choice',
          difficulty: 2,
          chapter: '函数、极限、连续',
          section: '函数极限',
          knowledge_points: ['kp-1-4-5'],
          title: '题目示例',
          content: '求极限 $\\lim_{x \\to 0} \\frac{\\sin x}{x}$',
          answer: '1',
          solution: '利用重要极限...',
          hints: ['使用重要极限'],
          tags: ['极限', '重要极限'],
          options: ['A. 0', 'B. 1', 'C. -1', 'D. 不存在'],
          source: '自编题库',
          year: 2025,
        },
      ],
    },
    fields: {
      type: '题目类型: choice | fill_in | calculation | proof',
      difficulty: '难度: 1-5',
      chapter: '章节名称',
      section: '小节名称（可选）',
      knowledge_points: '关联知识点 ID 或名称列表',
      title: '题目标题（可选）',
      content: '题目内容，支持 LaTeX 公式 $...$ 或 $$...$$',
      answer: '正确答案',
      solution: '解析过程（可选）',
      hints: '提示列表（可选）',
      tags: '标签列表（可选）',
      options: '选项列表，仅选择题需要',
      source: '题目来源（可选）',
      year: '真题年份（可选）',
    },
  });
});

// 批量导入真题（JSON 文件格式）
questionUploadRoutes.post('/import-exam', async (req, res) => {
  try {
    const { examName, year, questions } = req.body as {
      examName: string;
      year: number;
      questions: Array<{
        type: string;
        difficulty: number;
        content: string;
        answer: string;
        solution?: string;
        options?: string[];
        knowledge_points?: string[];
      }>;
    };

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: '缺少 questions 数组' });
    }

    const source = `${year}年${examName}`;
    const results = { imported: 0, skipped: 0, errors: 0 };

    for (const q of questions) {
      try {
        await prisma.question.create({
          data: {
            content: q.content,
            questionType: q.type || 'choice',
            options: q.options ? JSON.stringify(q.options) : null,
            answer: q.answer,
            solution: q.solution || '',
            difficulty: q.difficulty || 2,
            source,
          },
        });
        results.imported++;
      } catch (e: any) {
        if (e.code === 'P2002') results.skipped++;
        else results.errors++;
      }
    }

    res.json({ success: true, ...results });
  } catch (error) {
    res.status(500).json({ error: '导入真题失败' });
  }
});