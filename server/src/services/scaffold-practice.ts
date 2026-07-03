import { prisma } from '../db';

export interface ScaffoldHint {
  step: number;
  content: string;
  triggerCondition: string | null;
}

export interface ScaffoldSession {
  questionId: number;
  questionContent: string;
  answer: string;
  solution: string;
  knowledgePoints: string[];
  currentHintStep: number;
  hints: ScaffoldHint[];
  difficulty: number;
}

const HINT_TEMPLATES: Record<string, string[]> = {
  '极限与连续': [
    '先观察题目类型：是哪种极限形式？是 $\\frac{0}{0}$ 型还是 $\\frac{\\infty}{\\infty}$ 型？',
    '思考一下，有没有等价无穷小可以替换？常用的有：$\\sin x \\sim x$，$\\tan x \\sim x$，$1-\\cos x \\sim \\frac{x^2}{2}$，$e^x-1 \\sim x$，$\\ln(1+x) \\sim x$',
    '如果等价无穷小不够用，试试洛必达法则：对分子分母分别求导',
    '如果还不行，考虑泰勒展开：将函数展开到足够高的阶数',
    '检查结果是否合理，比如极限值是否在预期范围内',
  ],
  '导数与微分': [
    '先判断使用什么求导法则：基本公式、链式法则、乘积法则还是商法则？',
    '如果是复合函数，需要使用链式法则：$(f(g(x)))\' = f\'(g(x)) \\cdot g\'(x)$',
    '如果是乘积：$(uv)\' = u\'v + uv\'$；如果是商：$(\\frac{u}{v})\' = \\frac{u\'v - uv\'}{v^2}$',
    '小心处理符号和常数，逐步计算，不要跳步',
    '最后检查：结果是否满足函数的基本性质？',
  ],
  '不定积分': [
    '先判断积分类型：是基本积分、凑微分、换元还是分部积分？',
    '尝试凑微分法：$\\int f\'(g(x))g\'(x)dx = f(g(x)) + C$',
    '如果凑微分不行，试试换元法：令 $u = g(x)$，则 $du = g\'(x)dx$',
    '对于乘积型积分，考虑分部积分：$\\int u dv = uv - \\int v du$',
    '积分完成后加上常数 $C$，并检查求导是否还原',
  ],
  '定积分': [
    '先用牛顿-莱布尼茨公式：$\\int_a^b f(x)dx = F(b) - F(a)$',
    '注意积分上下限的代入顺序：上限减下限',
    '如果积分区间对称，考虑奇偶性简化计算',
    '检查被积函数在积分区间内是否有瑕点',
    '验证结果是否合理，比如积分值是否在预期范围内',
  ],
  '行列式': [
    '先看行列式的阶数，2阶直接用 $ad-bc$ 公式',
    '3阶及以上可以用展开法：选一行或一列，按代数余子式展开',
    '观察行列式是否有特殊结构：三角行列式、范德蒙行列式等',
    '利用行列式的性质：行变换不影响值，提取公因子等',
    '最后验证：是否满足行列式的基本性质？',
  ],
  '矩阵': [
    '先明确矩阵的维度，确认运算是否合法（乘法要求前列等于后行）',
    '矩阵乘法：$(AB)_{ij} = \\sum_k a_{ik}b_{kj}$，逐元素计算',
    '求逆矩阵：用伴随矩阵法 $A^{-1} = \\frac{A^*}{|A|}$ 或初等变换法',
    '注意：不是所有矩阵都可逆，需要 $|A| \\neq 0$',
    '最后验证：$AA^{-1} = I$ 是否成立',
  ],
  '特征值与特征向量': [
    '从特征方程出发：$\\det(A - \\lambda I) = 0$，解出特征值 $\\lambda$',
    '对每个特征值，解 $(A - \\lambda I)x = 0$ 得到特征向量',
    '注意特征向量的倍数仍为特征向量，通常要求单位化',
    '验证：$Ax = \\lambda x$ 是否成立',
    '检查特征值的和是否等于迹，积是否等于行列式',
  ],
  default: [
    '先审题：明确题目要求什么，已知条件是什么',
    '找出相关的知识点和公式',
    '尝试用已知方法代入，看看能否得出结果',
    '如果卡住了，换个角度思考，有没有其他方法？',
    '检查答案是否合理，有没有遗漏条件',
  ],
};

export function getHintsForChapter(chapter: string): string[] {
  for (const [key, hints] of Object.entries(HINT_TEMPLATES)) {
    if (chapter.includes(key)) return hints;
  }
  return HINT_TEMPLATES.default;
}

export async function createScaffoldSession(
  questionId: number,
  chapter?: string
): Promise<ScaffoldSession> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      knowledgePoints: {
        include: { knowledgePoint: true },
      },
    },
  });

  if (!question) {
    throw new Error('Question not found');
  }

  const kpChapter = chapter || question.knowledgePoints[0]?.knowledgePoint.chapter || '';
  const hintTexts = getHintsForChapter(kpChapter);
  const hints: ScaffoldHint[] = hintTexts.map((content, i) => ({
    step: i + 1,
    content,
    triggerCondition: i === 0 ? 'first_wrong' : `after_hint_${i}`,
  }));

  return {
    questionId: question.id,
    questionContent: question.content,
    answer: question.answer,
    solution: question.solution,
    knowledgePoints: question.knowledgePoints.map(k => k.knowledgePoint.name),
    currentHintStep: 0,
    hints,
    difficulty: question.difficulty,
  };
}

export async function getNextHint(
  session: ScaffoldSession
): Promise<{ hint: ScaffoldHint | null; session: ScaffoldSession }> {
  const nextStep = session.currentHintStep + 1;
  if (nextStep > session.hints.length) {
    return { hint: null, session };
  }

  const hint = session.hints[nextStep - 1];
  return {
    hint,
    session: { ...session, currentHintStep: nextStep },
  };
}

export async function revealSolution(
  session: ScaffoldSession
): Promise<{ solution: string; answer: string }> {
  return {
    solution: session.solution,
    answer: session.answer,
  };
}