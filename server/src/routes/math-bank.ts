import { Router } from 'express';
import { prisma } from '../db';
import { MATH_COMPREHENSIVE_DATA } from '../data/math-comprehensive';

export const mathBankRoutes = Router();

const MATH_QUESTIONS = [
  {
    content: '求极限：\\[\\lim_{x \\to 0} \\frac{\\sin 3x}{x}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. 3', 'D. 不存在']),
    answer: 'C',
    solution: '利用重要极限 \\[\\lim_{x \\to 0} \\frac{\\sin ax}{x} = a\\]，因此 \\[\\lim_{x \\to 0} \\frac{\\sin 3x}{x} = 3\\]',
    difficulty: 1,
    kpName: '极限存在准则与两个重要极限',
    source: '考研数学真题',
  },
  {
    content: '设函数 \\[f(x) = e^x \\sin x\\]，求 \\[f\'(x)\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[e^x \\cos x\\]', 'B. \\[e^x (\\sin x + \\cos x)\\]', 'C. \\[e^x (\\sin x - \\cos x)\\]', 'D. \\[e^x \\sin x + \\cos x\\]']),
    answer: 'B',
    solution: '利用乘积求导法则：\\[f\'(x) = (e^x)\'\\sin x + e^x(\\sin x)\' = e^x\\sin x + e^x\\cos x = e^x(\\sin x + \\cos x)\\]',
    difficulty: 1,
    kpName: '函数的求导法则',
    source: '考研数学真题',
  },
  {
    content: '求不定积分：\\[\\int x \\cos x \\,dx\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[x\\sin x + \\cos x + C\\]', 'B. \\[x\\sin x - \\cos x + C\\]', 'C. \\[x\\cos x + \\sin x + C\\]', 'D. \\[x\\cos x - \\sin x + C\\]']),
    answer: 'A',
    solution: '使用分部积分法：\\[\\int x\\cos x\\,dx = x\\sin x - \\int \\sin x\\,dx = x\\sin x + \\cos x + C\\]',
    difficulty: 1,
    kpName: '分部积分法',
    source: '考研数学真题',
  },
  {
    content: '判断级数 \\[\\sum_{n=1}^{\\infty} \\frac{1}{n^2}\\] 的收敛性',
    questionType: 'choice',
    options: JSON.stringify(['A. 发散', 'B. 收敛', 'C. 条件收敛', 'D. 无法判断']),
    answer: 'B',
    solution: '这是p-级数 \\[\\sum \\frac{1}{n^p}\\]，当 \\[p=2>1\\] 时收敛。',
    difficulty: 1,
    kpName: '常数项级数的审敛法',
    source: '考研数学真题',
  },
  {
    content: '求极限：\\[\\lim_{x \\to 0} \\frac{\\tan x - \\sin x}{x^3}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. \\[\\frac{1}{2}\\]', 'C. 1', 'D. 2']),
    answer: 'B',
    solution: '使用泰勒展开：\\[\\tan x = x + \\frac{x^3}{3} + o(x^3)\\]，\\[\\sin x = x - \\frac{x^3}{6} + o(x^3)\\]，所以 \\[\\tan x - \\sin x = \\frac{x^3}{2} + o(x^3)\\]，因此极限为 \\[\\frac{1}{2}\\]',
    difficulty: 2,
    kpName: '泰勒公式',
    source: '考研数学真题',
  },
  {
    content: '计算二重积分：\\[\\iint_D xy\\,dxdy\\]，其中 \\[D = \\{(x,y) | 0 \\leq x \\leq 1, 0 \\leq y \\leq x\\}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[\\frac{1}{4}\\]', 'B. \\[\\frac{1}{6}\\]', 'C. \\[\\frac{1}{8}\\]', 'D. \\[\\frac{1}{12}\\]']),
    answer: 'C',
    solution: '\\[\\iint_D xy\\,dxdy = \\int_0^1 \\int_0^x xy\\,dydx = \\int_0^1 x \\cdot \\frac{x^2}{2}\\,dx = \\frac{1}{2}\\int_0^1 x^3\\,dx = \\frac{1}{8}\\]',
    difficulty: 2,
    kpName: '二重积分的计算',
    source: '考研数学真题',
  },
  {
    content: '设矩阵 \\[A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}\\]，求 \\[A^{-1}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[\\begin{pmatrix} -2 & 1 \\\\ 1.5 & -0.5 \\end{pmatrix}\\]', 'B. \\[\\begin{pmatrix} 4 & -2 \\\\ -3 & 1 \\end{pmatrix}\\]', 'C. \\[\\begin{pmatrix} 2 & -1 \\\\ -1.5 & 0.5 \\end{pmatrix}\\]', 'D. \\[\\begin{pmatrix} -4 & 2 \\\\ 3 & -1 \\end{pmatrix}\\]']),
    answer: 'A',
    solution: '\\[|A|=1\\times4-2\\times3=-2\\]，\\[A^* = \\begin{pmatrix} 4 & -2 \\\\ -3 & 1 \\end{pmatrix}\\]，\\[A^{-1} = \\frac{1}{|A|}A^* = \\begin{pmatrix} -2 & 1 \\\\ 1.5 & -0.5 \\end{pmatrix}\\]',
    difficulty: 1,
    kpName: '逆矩阵',
    source: '考研数学真题',
  },
  {
    content: '设随机变量 \\[X \\sim N(0,1)\\]，求 \\[P(|X| \\leq 1.96)\\]（已知 \\[\\Phi(1.96)=0.975\\]）',
    questionType: 'choice',
    options: JSON.stringify(['A. 0.90', 'B. 0.95', 'C. 0.975', 'D. 0.99']),
    answer: 'B',
    solution: '\\[P(|X| \\leq 1.96) = P(-1.96 \\leq X \\leq 1.96) = \\Phi(1.96) - \\Phi(-1.96) = 2\\Phi(1.96) - 1 = 2\\times 0.975 - 1 = 0.95\\]',
    difficulty: 1,
    kpName: '连续型随机变量',
    source: '考研数学真题',
  },
  {
    content: '求微分方程 \\[y\' + 2xy = x\\] 的通解',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[y = \\frac{1}{2} + Ce^{-x^2}\\]', 'B. \\[y = \\frac{1}{2} + Ce^{x^2}\\]', 'C. \\[y = -\\frac{1}{2} + Ce^{x^2}\\]', 'D. \\[y = 1 + Ce^{-x^2}\\]']),
    answer: 'A',
    solution: '这是一阶线性微分方程，积分因子 \\[\\mu = e^{\\int 2x\\,dx} = e^{x^2}\\]，\\[y = e^{-x^2}\\int x e^{x^2}\\,dx = \\frac{1}{2} + Ce^{-x^2}\\]',
    difficulty: 2,
    kpName: '一阶微分方程',
    source: '考研数学真题',
  },
  {
    content: '设函数 \\[f(x) = x^3 - 3x + 1\\]，求 \\[f(x)\\] 在 \\[[-2,2]\\] 上的最大值',
    questionType: 'choice',
    options: JSON.stringify(['A. 1', 'B. 3', 'C. 5', 'D. -1']),
    answer: 'B',
    solution: '\\[f\'(x) = 3x^2 - 3 = 3(x-1)(x+1)\\]，驻点 \\[x=\\pm1\\]，\\[f(-2)=-1\\]，\\[f(-1)=3\\]，\\[f(1)=-1\\]，\\[f(2)=3\\]，最大值为3',
    difficulty: 1,
    kpName: '函数的极值与最值',
    source: '考研数学真题',
  },
  {
    content: '求 \\[\\int_0^1 x e^x\\,dx\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[e-1\\]', 'B. 1', 'C. \\[e\\]', 'D. \\[e-2\\]']),
    answer: 'B',
    solution: '使用分部积分：\\[\\int_0^1 xe^x\\,dx = [xe^x]_0^1 - \\int_0^1 e^x\\,dx = e - (e-1) = 1\\]',
    difficulty: 1,
    kpName: '定积分的换元法和分部积分法',
    source: '考研数学真题',
  },
  {
    content: '求幂级数 \\[\\sum_{n=0}^{\\infty} \\frac{x^n}{n!}\\] 的收敛半径',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. \\[\\infty\\]', 'D. \\[e\\]']),
    answer: 'C',
    solution: '使用比值法：\\[\\lim_{n\\to\\infty} \\left|\\frac{a_{n+1}}{a_n}\\right| = \\lim_{n\\to\\infty} \\frac{1}{n+1} = 0\\]，收敛半径 \\[R = \\infty\\]',
    difficulty: 2,
    kpName: '幂级数',
    source: '考研数学真题',
  },
  {
    content: '设 \\[f(x,y) = x^2 + y^2 - xy\\]，求 \\[f(x,y)\\] 的极值',
    questionType: 'choice',
    options: JSON.stringify(['A. 极小值0', 'B. 极大值0', 'C. 极小值-1', 'D. 无极值']),
    answer: 'A',
    solution: '\\[f_x = 2x - y = 0\\]，\\[f_y = 2y - x = 0\\]，解得 \\[x=y=0\\]，\\[f_{xx}=2\\]，\\[f_{xy}=-1\\]，\\[f_{yy}=2\\]，\\[\\Delta = 4-1=3>0\\]，\\[f_{xx}>0\\]，故为极小值点，极小值为0',
    difficulty: 2,
    kpName: '多元函数的极值',
    source: '考研数学真题',
  },
  {
    content: '若 \\[\\lim_{x \\to 0} \\frac{f(x)}{x} = 1\\]，且 \\[f(0)=0\\]，则 \\[f\'(0)\\] 等于',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. -1', 'D. 无法确定']),
    answer: 'B',
    solution: '由导数定义，\\[f\'(0) = \\lim_{x \\to 0} \\frac{f(x) - f(0)}{x-0} = \\lim_{x \\to 0} \\frac{f(x)}{x} = 1\\]',
    difficulty: 1,
    kpName: '导数概念',
    source: '考研数学真题',
  },
  {
    content: '求 \\[\\int \\frac{1}{x^2 + a^2}\\,dx\\]（\\[a>0\\]）',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[\\frac{1}{a}\\arctan\\frac{x}{a} + C\\]', 'B. \\[\\arctan\\frac{x}{a} + C\\]', 'C. \\[\\frac{1}{2a}\\ln|\\frac{x-a}{x+a}| + C\\]', 'D. \\[\\ln|x^2+a^2| + C\\]']),
    answer: 'A',
    solution: '\\[\\int \\frac{1}{x^2+a^2}\\,dx = \\frac{1}{a}\\arctan\\frac{x}{a} + C\\]（基本积分公式）',
    difficulty: 1,
    kpName: '换元积分法',
    source: '基础习题',
  },
  {
    content: '计算行列式 \\[\\begin{vmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{vmatrix}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 6', 'B. 0', 'C. -6', 'D. 12']),
    answer: 'B',
    solution: '第二行减第一行，第三行减第二行，发现两行成比例，行列式为0。或直接计算：\\[45+84+96-105-48-72=0\\]',
    difficulty: 1,
    kpName: '行列式的计算',
    source: '基础习题',
  },
  {
    content: '设随机变量 \\[X \\sim B(n,p)\\]，若 \\[E(X)=6\\]，\\[D(X)=2\\]，求 \\[n\\] 和 \\[p\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[n=9,p=\\frac{2}{3}\\]', 'B. \\[n=18,p=\\frac{1}{3}\\]', 'C. \\[n=9,p=\\frac{1}{3}\\]', 'D. \\[n=6,p=1\\]']),
    answer: 'A',
    solution: '由二项分布：\\[E(X)=np=6\\]，\\[D(X)=np(1-p)=2\\]，代入得 \\[6(1-p)=2\\]，\\[p=\\frac{2}{3}\\]，\\[n=9\\]',
    difficulty: 1,
    kpName: '数学期望',
    source: '考研数学真题',
  },
  {
    content: '求曲线 \\[y = x^2\\] 与 \\[y = x\\] 围成的面积',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[\\frac{1}{2}\\]', 'B. \\[\\frac{1}{3}\\]', 'C. \\[\\frac{1}{6}\\]', 'D. \\[\\frac{1}{4}\\]']),
    answer: 'C',
    solution: '两曲线交点：\\[x^2=x\\]，\\[x=0,1\\]，面积 \\[S = \\int_0^1 (x - x^2)\\,dx = [\\frac{x^2}{2} - \\frac{x^3}{3}]_0^1 = \\frac{1}{6}\\]',
    difficulty: 1,
    kpName: '定积分求面积',
    source: '基础习题',
  },
  {
    content: '求 \\[\\lim_{x \\to 0} (1+2x)^{\\frac{1}{x}}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[e\\]', 'B. \\[e^2\\]', 'C. \\[2e\\]', 'D. 1']),
    answer: 'B',
    solution: '利用重要极限 \\[\\lim_{x \\to 0} (1+ax)^{\\frac{1}{x}} = e^a\\]，因此 \\[\\lim_{x \\to 0} (1+2x)^{\\frac{1}{x}} = e^2\\]',
    difficulty: 1,
    kpName: '极限存在准则与两个重要极限',
    source: '基础习题',
  },
  {
    content: '设 \\[f(x) = \\ln(1+x)\\]，求 \\[f^{(n)}(0)\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[(-1)^{n-1}(n-1)!\\]', 'B. \\[n!\\]', 'C. \\[(-1)^n n!\\]', 'D. \\[(n-1)!\\]']),
    answer: 'A',
    solution: '\\[f\'(x)=\\frac{1}{1+x}\\]，\\[f\'\'(x)=-\\frac{1}{(1+x)^2}\\]，\\[f\'\'\'(x)=\\frac{2}{(1+x)^3}\\]，归纳得 \\[f^{(n)}(x)=(-1)^{n-1}\\frac{(n-1)!}{(1+x)^n}\\]，所以 \\[f^{(n)}(0)=(-1)^{n-1}(n-1)!\\]',
    difficulty: 2,
    kpName: '高阶导数',
    source: '考研数学真题',
  },
  {
    content: '设向量组 \\[\\alpha_1=(1,0,0)\\]，\\[\\alpha_2=(0,1,0)\\]，\\[\\alpha_3=(1,1,0)\\]，判断其线性相关性',
    questionType: 'choice',
    options: JSON.stringify(['A. 线性无关', 'B. 线性相关', 'C. 无法判断', 'D. 只有一个向量相关']),
    answer: 'B',
    solution: '\\[\\alpha_3 = \\alpha_1 + \\alpha_2\\]，所以向量组线性相关。',
    difficulty: 1,
    kpName: '向量组的线性相关性',
    source: '考研数学真题',
  },
  {
    content: '求 \\[\\int_0^{+\\infty} e^{-x}\\,dx\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. 发散', 'D. \\[e\\]']),
    answer: 'B',
    solution: '\\[\\int_0^{+\\infty} e^{-x}\\,dx = \\lim_{b\\to+\\infty}[-e^{-x}]_0^b = \\lim_{b\\to+\\infty}(-e^{-b}+1) = 1\\]',
    difficulty: 1,
    kpName: '反常积分',
    source: '基础习题',
  },
  {
    content: '设 \\[A\\] 为 \\[3\\times3\\] 矩阵，\\[|A|=2\\]，求 \\[|2A|\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 4', 'B. 8', 'C. 16', 'D. 2']),
    answer: 'C',
    solution: '对于 \\[n\\] 阶方阵，\\[|kA| = k^n|A|\\]，\\[n=3\\]，\\[|2A| = 2^3 \\times 2 = 16\\]',
    difficulty: 1,
    kpName: '行列式的定义与性质',
    source: '考研数学真题',
  },
  {
    content: '求 \\[\\lim_{x \\to \\infty} \\frac{3x^2 + 2x - 1}{x^2 + 5}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. 3', 'D. \\[\\infty\\]']),
    answer: 'C',
    solution: '分子分母同除以 \\[x^2\\]：\\[\\lim_{x\\to\\infty} \\frac{3+2/x-1/x^2}{1+5/x^2} = 3\\]',
    difficulty: 1,
    kpName: '极限运算法则',
    source: '基础习题',
  },
  {
    content: '求微分方程 \\[y\'\' - 4y\' + 4y = 0\\] 的通解',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[y = (C_1 + C_2x)e^{2x}\\]', 'B. \\[y = C_1e^{2x} + C_2e^{-2x}\\]', 'C. \\[y = e^{2x}(C_1\\cos 2x + C_2\\sin 2x)\\]', 'D. \\[y = C_1e^{2x} + C_2e^{4x}\\]']),
    answer: 'A',
    solution: '特征方程 \\[r^2-4r+4=0\\]，\\[(r-2)^2=0\\]，重根 \\[r=2\\]，通解为 \\[y=(C_1+C_2x)e^{2x}\\]',
    difficulty: 2,
    kpName: '常系数线性微分方程',
    source: '考研数学真题',
  },
  {
    content: '设 \\[z = e^{xy}\\]，求 \\[\\frac{\\partial z}{\\partial x}\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[e^{xy}\\]', 'B. \\[xe^{xy}\\]', 'C. \\[ye^{xy}\\]', 'D. \\[xye^{xy}\\]']),
    answer: 'C',
    solution: '将 \\[y\\] 视为常数，\\[\\frac{\\partial z}{\\partial x} = e^{xy} \\cdot y = ye^{xy}\\]',
    difficulty: 1,
    kpName: '偏导数',
    source: '基础习题',
  },
  {
    content: '设事件 \\[A\\] 与 \\[B\\] 独立，\\[P(A)=0.4\\]，\\[P(B)=0.5\\]，求 \\[P(A \\cup B)\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0.9', 'B. 0.7', 'C. 0.2', 'D. 0.6']),
    answer: 'B',
    solution: '\\[P(A\\cup B) = P(A) + P(B) - P(AB) = P(A) + P(B) - P(A)P(B) = 0.4 + 0.5 - 0.2 = 0.7\\]',
    difficulty: 1,
    kpName: '条件概率与独立性',
    source: '考研数学真题',
  },
  {
    content: '求 \\[f(x) = x^4 - 2x^2 + 5\\] 的单调递增区间',
    questionType: 'choice',
    options: JSON.stringify(['A. \\[(-1,0)\\cup(1,+\\infty)\\]', 'B. \\[(-\\infty,-1)\\cup(0,1)\\]', 'C. \\[(-1,1)\\]', 'D. \\[(-\\infty,+\\infty)\\]']),
    answer: 'A',
    solution: '\\[f\'(x) = 4x^3 - 4x = 4x(x-1)(x+1)\\]，令 \\[f\'(x)>0\\]，得 \\[x\\in(-1,0)\\cup(1,+\\infty)\\]',
    difficulty: 1,
    kpName: '函数的单调性与凹凸性',
    source: '基础习题',
  },
  {
    content: '求 \\[\\int_0^\\pi \\sin x\\,dx\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. 2', 'D. -2']),
    answer: 'C',
    solution: '\\[\\int_0^\\pi \\sin x\\,dx = [-\\cos x]_0^\\pi = -\\cos\\pi + \\cos 0 = 1 + 1 = 2\\]',
    difficulty: 1,
    kpName: '微积分基本公式',
    source: '基础习题',
  },
  {
    content: '设 \\[A = \\begin{pmatrix} 1 & 0 \\\\ 0 & 2 \\end{pmatrix}\\]，求 \\[A\\] 的特征值',
    questionType: 'choice',
    options: JSON.stringify(['A. 1, 0', 'B. 1, 2', 'C. 0, 2', 'D. 1, 1']),
    answer: 'B',
    solution: '对角矩阵的特征值就是对角线元素，即 \\[\\lambda_1=1\\]，\\[\\lambda_2=2\\]',
    difficulty: 1,
    kpName: '特征值与特征向量',
    source: '考研数学真题',
  },
  {
    content: '设 \\[f(x) = \\begin{cases} x^2\\sin\\frac{1}{x}, & x \\neq 0 \\\\ 0, & x = 0 \\end{cases}\\]，求 \\[f\'(0)\\]',
    questionType: 'choice',
    options: JSON.stringify(['A. 0', 'B. 1', 'C. 不存在', 'D. -1']),
    answer: 'A',
    solution: '由导数定义，\\[f\'(0) = \\lim_{x\\to 0} \\frac{x^2\\sin(1/x)-0}{x} = \\lim_{x\\to 0} x\\sin(1/x) = 0\\]（无穷小量乘以有界量）',
    difficulty: 2,
    kpName: '导数概念',
    source: '考研数学真题',
  },
];

mathBankRoutes.get('/questions', async (_req, res) => {
  try {
    res.json({ questions: MATH_QUESTIONS, total: MATH_QUESTIONS.length });
  } catch (error) {
    res.status(500).json({ error: '获取题库失败' });
  }
});

mathBankRoutes.post('/seed', async (_req, res) => {
  try {
    let created = 0;
    for (const q of MATH_QUESTIONS) {
      const kp = await prisma.knowledgePoint.findFirst({
        where: { name: q.kpName, subject: 'math' },
      });
      if (!kp) continue;

      const existing = await prisma.question.findFirst({
        where: { content: q.content },
      });
      if (existing) continue;

      await prisma.question.create({
        data: {
          content: q.content,
          questionType: q.questionType,
          options: q.options,
          answer: q.answer,
          solution: q.solution,
          difficulty: q.difficulty,
          source: q.source,
          knowledgePoints: {
            create: { knowledgePointId: kp.id },
          },
        },
      });
      created++;
    }
    res.json({ message: `成功导入 ${created} 道题目`, created, total: MATH_QUESTIONS.length });
  } catch (error) {
    res.status(500).json({ error: '导入题库失败' });
  }
});

mathBankRoutes.get('/categories', (_req, res) => {
  res.json(MATH_COMPREHENSIVE_DATA.categories);
});

mathBankRoutes.get('/knowledge-tree', (_req, res) => {
  res.json(MATH_COMPREHENSIVE_DATA.knowledgeTree);
});

mathBankRoutes.get('/mock-exams', (_req, res) => {
  res.json(MATH_COMPREHENSIVE_DATA.mockExams);
});

mathBankRoutes.get('/real-exams', (_req, res) => {
  res.json(MATH_COMPREHENSIVE_DATA.realExams);
});

mathBankRoutes.get('/real-exams/:year', (req, res) => {
  const { year } = req.params;
  const exam = MATH_COMPREHENSIVE_DATA.realExams.find(e => e.year === parseInt(year));
  if (exam) {
    res.json(exam);
  } else {
    res.status(404).json({ error: '未找到该年份真题' });
  }
});

mathBankRoutes.get('/mock-exams/:id', (req, res) => {
  const { id } = req.params;
  const exam = MATH_COMPREHENSIVE_DATA.mockExams.find(e => e.id === id);
  if (exam) {
    res.json(exam);
  } else {
    res.status(404).json({ error: '未找到该模拟卷' });
  }
});