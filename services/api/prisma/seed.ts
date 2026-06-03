import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 创建学科
  const math = await prisma.subject.upsert({
    where: { code: 'math' },
    update: {},
    create: {
      name: '数学',
      code: 'math',
      icon: 'calculator',
      color: '#3B82F6',
      description: '考研数学',
      sortOrder: 1,
    },
  });

  const politics = await prisma.subject.upsert({
    where: { code: 'politics' },
    update: {},
    create: {
      name: '政治',
      code: 'politics',
      icon: 'book',
      color: '#EF4444',
      description: '考研政治',
      sortOrder: 2,
    },
  });

  const english = await prisma.subject.upsert({
    where: { code: 'english' },
    update: {},
    create: {
      name: '英语',
      code: 'english',
      icon: 'language',
      color: '#10B981',
      description: '考研英语',
      sortOrder: 3,
    },
  });

  const major = await prisma.subject.upsert({
    where: { code: 'major' },
    update: {},
    create: {
      name: '专业课',
      code: 'major',
      icon: 'school',
      color: '#F59E0B',
      description: '专业课',
      sortOrder: 4,
    },
  });

  console.log({ math, politics, english, major });

  // 创建成就
  const achievements = [
    {
      code: 'first_question',
      name: '初试锋芒',
      description: '完成第一道题目',
      type: 'QUESTION_COUNT',
      condition: { type: 'count', value: 1 },
      points: 10,
      rarity: 'COMMON',
    },
    {
      code: 'first_100_questions',
      name: '百题斩',
      description: '累计完成100道题目',
      type: 'QUESTION_COUNT',
      condition: { type: 'count', value: 100 },
      points: 50,
      rarity: 'UNCOMMON',
    },
    {
      code: 'first_1000_questions',
      name: '千题王',
      description: '累计完成1000道题目',
      type: 'QUESTION_COUNT',
      condition: { type: 'count', value: 1000 },
      points: 200,
      rarity: 'RARE',
    },
    {
      code: 'streak_7',
      name: '坚持一周',
      description: '连续学习7天',
      type: 'STREAK',
      condition: { type: 'streak', value: 7 },
      points: 30,
      rarity: 'UNCOMMON',
    },
    {
      code: 'streak_30',
      name: '月度达人',
      description: '连续学习30天',
      type: 'STREAK',
      condition: { type: 'streak', value: 30 },
      points: 100,
      rarity: 'RARE',
    },
    {
      code: 'accuracy_80',
      name: '精准射手',
      description: '正确率达到80%',
      type: 'ACCURACY',
      condition: { type: 'rate', value: 80 },
      points: 50,
      rarity: 'UNCOMMON',
    },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { code: achievement.code },
      update: {},
      create: achievement as any,
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
