import { Router } from 'express';
import { prisma } from '../db';

export const englishPathRoutes = Router();

const ASSESSMENT_QUESTIONS = [
  {
    id: 1,
    type: 'vocabulary',
    word: 'abandon',
    question: '"abandon" 的中文含义是？',
    options: ['放弃', '获得', '坚持', '改变'],
    answer: '放弃',
    difficulty: 'easy',
  },
  {
    id: 2,
    type: 'vocabulary',
    word: 'significant',
    question: '"significant" 的中文含义是？',
    options: ['简单的', '重要的', '快乐的', '快速的'],
    answer: '重要的',
    difficulty: 'easy',
  },
  {
    id: 3,
    type: 'vocabulary',
    word: 'phenomenon',
    question: '"phenomenon" 的中文含义是？',
    options: ['现象', '哲学', '物理学', '心理学'],
    answer: '现象',
    difficulty: 'medium',
  },
  {
    id: 4,
    type: 'vocabulary',
    word: 'contemporary',
    question: '"contemporary" 的中文含义是？',
    options: ['暂时的', '当代的', '古老的', '遥远的'],
    answer: '当代的',
    difficulty: 'medium',
  },
  {
    id: 5,
    type: 'grammar',
    question: 'He ____ to school every day.',
    options: ['go', 'goes', 'going', 'gone'],
    answer: 'goes',
    difficulty: 'easy',
  },
  {
    id: 6,
    type: 'grammar',
    question: 'If I ____ you, I would study harder.',
    options: ['am', 'was', 'were', 'be'],
    answer: 'were',
    difficulty: 'medium',
  },
  {
    id: 7,
    type: 'vocabulary',
    word: 'ambiguous',
    question: '"ambiguous" 的中文含义是？',
    options: ['明确的', '模糊的', '宏大的', '具体的'],
    answer: '模糊的',
    difficulty: 'hard',
  },
  {
    id: 8,
    type: 'vocabulary',
    word: 'conscientious',
    question: '"conscientious" 的中文含义是？',
    options: ['认真的', '懒惰的', '快速的', '简单的'],
    answer: '认真的',
    difficulty: 'hard',
  },
  {
    id: 9,
    type: 'reading',
    passage: 'The industrial revolution brought significant changes to society. Factories replaced small workshops, and urbanization accelerated rapidly.',
    question: 'What is the main topic of this passage?',
    options: ['农业发展', '工业革命的影响', '教育变革', '医疗进步'],
    answer: '工业革命的影响',
    difficulty: 'medium',
  },
  {
    id: 10,
    type: 'reading',
    passage: 'Climate change poses one of the greatest challenges of our time. Rising temperatures, melting ice caps, and extreme weather events are all consequences.',
    question: 'According to the passage, which is NOT mentioned as a consequence of climate change?',
    options: ['Rising temperatures', 'Melting ice caps', 'Extreme weather', 'Volcanic eruptions'],
    answer: 'Volcanic eruptions',
    difficulty: 'hard',
  },
];

const LEARNING_PATHS: Record<string, {
  label: string;
  description: string;
  weeklyGoal: number;
  phases: { name: string; focus: string; wordsTarget: number; weeks: number; tasks: string[] }[];
}> = {
  beginner: {
    label: '基础夯实路径',
    description: '从零开始，打好英语基础，逐步建立信心',
    weeklyGoal: 30,
    phases: [
      {
        name: '第一阶段：词汇起步',
        focus: '高频基础词汇 + 简单语法',
        wordsTarget: 500,
        weeks: 4,
        tasks: ['每日学习15个新单词', '完成单词消消乐游戏', '每周一篇短阅读', '基础语法练习'],
      },
      {
        name: '第二阶段：语法强化',
        focus: '核心语法 + 基础阅读',
        wordsTarget: 800,
        weeks: 4,
        tasks: ['每日学习20个新单词', '语法填空练习', '每周两篇阅读', '单词速拼挑战'],
      },
      {
        name: '第三阶段：能力提升',
        focus: '阅读理解 + 写作入门',
        wordsTarget: 1000,
        weeks: 4,
        tasks: ['每日复习30个单词', '阅读理解训练', '单词拼图挑战', '简单写作练习'],
      },
      {
        name: '第四阶段：综合突破',
        focus: '真题模拟 + 全面冲刺',
        wordsTarget: 1500,
        weeks: 4,
        tasks: ['每日复习40个单词', '模拟真题训练', '综合游戏挑战', '考试技巧特训'],
      },
    ],
  },
  intermediate: {
    label: '进阶提升路径',
    description: '在现有基础上突破瓶颈，达到考试要求水平',
    weeklyGoal: 50,
    phases: [
      {
        name: '第一阶段：词汇扩容',
        focus: '中高频词汇 + 长难句分析',
        wordsTarget: 800,
        weeks: 3,
        tasks: ['每日学习25个新单词', '长难句拆解练习', '单词速拼挑战', '语篇阅读训练'],
      },
      {
        name: '第二阶段：阅读突破',
        focus: '深度阅读 + 完形填空',
        wordsTarget: 1200,
        weeks: 3,
        tasks: ['每日学习30个新单词', '完形填空训练', '阅读速度挑战', '单词消消乐'],
      },
      {
        name: '第三阶段：写作与翻译',
        focus: '写作技巧 + 翻译训练',
        wordsTarget: 1600,
        weeks: 3,
        tasks: ['每日复习40个单词', '写作模板训练', '翻译实战', '综合模拟测试'],
      },
      {
        name: '第四阶段：考前冲刺',
        focus: '全真模拟 + 查漏补缺',
        wordsTarget: 2000,
        weeks: 3,
        tasks: ['每日复习50个单词', '全真模拟考试', '错题集中突破', '高频词汇速记'],
      },
    ],
  },
  advanced: {
    label: '高分冲刺路径',
    description: '精益求精，冲击高分，重点突破难点',
    weeklyGoal: 70,
    phases: [
      {
        name: '第一阶段：词汇精进',
        focus: '低频高分词 + 同义词辨析',
        wordsTarget: 1000,
        weeks: 2,
        tasks: ['每日学习40个高难词', '同义词辨析训练', '单词拼图大师', '学术阅读训练'],
      },
      {
        name: '第二阶段：阅读满分',
        focus: '学术阅读 + 逻辑推理',
        wordsTarget: 1500,
        weeks: 3,
        tasks: ['每日学习50个新单词', '学术文章精读', '逻辑推理训练', '速读挑战赛'],
      },
      {
        name: '第三阶段：写作巅峰',
        focus: '高分写作 + 地道表达',
        wordsTarget: 2000,
        weeks: 3,
        tasks: ['每日复习60个单词', '高分作文模板', '地道表达积累', '模拟写作训练'],
      },
      {
        name: '第四阶段：全真模拟',
        focus: '考前冲刺 + 心理建设',
        wordsTarget: 2500,
        weeks: 2,
        tasks: ['全量词汇复习', '全真模拟考试', '考前心理调节', '终极挑战赛'],
      },
    ],
  },
};

englishPathRoutes.get('/assessment', async (_req, res) => {
  try {
    const shuffled = [...ASSESSMENT_QUESTIONS].sort(() => Math.random() - 0.5);
    res.json({ questions: shuffled.slice(0, 8) });
  } catch (error) {
    res.status(500).json({ error: '获取评估题失败' });
  }
});

englishPathRoutes.post('/assessment/submit', async (req, res) => {
  try {
    const { userId, answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: '缺少答案数据' });
    }

    let correctCount = 0;
    for (const ans of answers) {
      const question = ASSESSMENT_QUESTIONS.find(q => q.id === ans.questionId);
      if (question && question.answer === ans.answer) {
        correctCount++;
      }
    }

    const accuracy = correctCount / Math.max(answers.length, 1);
    let level: string;
    if (accuracy >= 0.8) level = 'advanced';
    else if (accuracy >= 0.5) level = 'intermediate';
    else level = 'beginner';

    if (userId) {
      await prisma.user.update({
        where: { id: Number(userId) },
        data: { englishLevel: level },
      });
    }

    const path = LEARNING_PATHS[level];

    res.json({
      accuracy: Math.round(accuracy * 100),
      correctCount,
      totalQuestions: answers.length,
      level,
      learningPath: path,
    });
  } catch (error) {
    res.status(500).json({ error: '提交评估失败' });
  }
});

englishPathRoutes.get('/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.userId) },
      select: { englishLevel: true, targetExam: true },
    });

    const level = user?.englishLevel || 'beginner';
    const path = LEARNING_PATHS[level];

    const userWords = await prisma.userWord.count({
      where: { userId: Number(req.params.userId) },
    });

    const masteredWords = await prisma.userWord.count({
      where: {
        userId: Number(req.params.userId),
        memoryLevel: { gte: 5 },
      },
    });

    res.json({
      currentLevel: level,
      levelLabel: level === 'beginner' ? '初级' : level === 'intermediate' ? '中级' : '高级',
      targetExam: user?.targetExam || '考研英语',
      learningPath: path,
      progress: {
        totalWordsLearned: userWords,
        wordsMastered: masteredWords,
        masteryRate: userWords > 0 ? Math.round((masteredWords / userWords) * 100) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: '获取学习路径失败' });
  }
});