const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

interface GenQuestion {
  content: string;
  answer: string;
  solution: string;
  questionType: 'fill_in' | 'choice' | 'essay';
  options?: string[];
  difficulty: number;
  chapter?: string;
  knowledgePoints?: string[];
}

const LIMIT_TEMPLATES: GenQuestion[] = [
  {
    content: '求极限：$\\lim_{x\\to0}\\frac{\\sin({a}x)}{{b}x}$',
    answer: '{a}/{b}',
    solution: '利用等价无穷小替换：$\\sin({a}x)\\sim {a}x$，得 $\\lim_{x\\to0}\\frac{\\sin({a}x)}{{b}x}=\\lim_{x\\to0}\\frac{{a}x}{{b}x}=\\frac{{a}}{{b}}$',
    questionType: 'fill_in', difficulty: 1, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0}\\frac{\\tan({a}x)}{{b}x}$',
    answer: '{a}/{b}',
    solution: '利用等价无穷小：$\\tan({a}x)\\sim {a}x$，得$\\frac{{a}}{{b}}$',
    questionType: 'fill_in', difficulty: 1, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0}\\frac{1-\\cos({a}x)}{{b}x^2}$',
    answer: '{a2}/{2b}',
    solution: '$1-\\cos({a}x)\\sim\\frac{({a}x)^2}{2}$，得$\\frac{{a}^2}{2{b}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0}(1+{a}x)^{\\frac{{b}}{{c}x}}$',
    answer: 'e^{ab/c}',
    solution: '利用重要极限$(1+x)^{1/x}\\to e$，原式$=[(1+{a}x)^{1/{a}x}]^{{a}{b}/{c}}\\to e^{{a}{b}/{c}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to\\infty}(1+\\frac{{a}}{{b}x})^{{c}x}$',
    answer: 'e^{ac/b}',
    solution: '$(1+\\frac{{a}}{{b}x})^{{c}x}=[(1+\\frac{{a}}{{b}x})^{{b}x/{a}}]^{{a}{c}/{b}}\\to e^{{a}{c}/{b}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0}\\frac{e^{{a}x}-1}{{b}x}$',
    answer: '{a}/{b}',
    solution: '利用等价无穷小：$e^{{a}x}-1\\sim {a}x$，得$\\frac{{a}}{{b}}$',
    questionType: 'fill_in', difficulty: 1, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0}\\frac{\\ln(1+{a}x)}{{b}x}$',
    answer: '{a}/{b}',
    solution: '利用等价无穷小：$\\ln(1+{a}x)\\sim {a}x$，得$\\frac{{a}}{{b}}$',
    questionType: 'fill_in', difficulty: 1, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0}\\frac{\\tan({a}x)-\\sin({a}x)}{{b}x^3}$',
    answer: '{a3}/{2b}',
    solution: '$\\tan x-\\sin x = \\tan x(1-\\cos x)\\sim x\\cdot\\frac{x^2}{2}=\\frac{x^3}{2}$，得$\\frac{{a}^3}{2{b}}$',
    questionType: 'fill_in', difficulty: 3, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to0^+}x^{{a}}\\ln x$（其中$a>0$）',
    answer: '0',
    solution: '利用洛必达法则：$\\lim x^{a}\\ln x=\\lim\\frac{\\ln x}{x^{-a}}=\\lim\\frac{1/x}{-a x^{-a-1}}=\\lim\\frac{-x^{a}}{a}=0$',
    questionType: 'fill_in', difficulty: 3, chapter: '极限与连续',
  },
  {
    content: '求极限：$\\lim_{x\\to{a}}\\frac{x^{n}-{a}^{n}}{x-{a}}$',
    answer: '{n}{anm1}',
    solution: '利用导数定义或因式分解：$x^{n}-a^{n}=(x-a)(x^{n-1}+x^{n-2}a+\\cdots+a^{n-1})$，代入$x=a$得$n a^{n-1}$',
    questionType: 'fill_in', difficulty: 2, chapter: '极限与连续',
  },
];

const DERIVATIVE_TEMPLATES: GenQuestion[] = [
  {
    content: '求函数$f(x)={a}x^{n}+{b}x+{c}$的导数$f\'(x)$',
    answer: '{an}x^{n-1}+{b}',
    solution: '利用幂函数求导公式：$(x^n)\'=nx^{n-1}$，得$f\'(x)={a}n x^{n-1}+{b}$',
    questionType: 'fill_in', difficulty: 1, chapter: '导数与微分',
  },
  {
    content: '求$y={a}\\sin({b}x)$在$x={c}$处的导数',
    answer: '{ab}cos({bc})',
    solution: '$y\'={a}{b}\\cos({b}x)$，代入$x={c}$得${ab}\\cos({bc})$',
    questionType: 'fill_in', difficulty: 1, chapter: '导数与微分',
  },
  {
    content: '求$y={a}e^{{b}x}\\cos({c}x)$的导数$y\'$',
    answer: '{a}e^{bx}({b}cos({c}x)-{c}sin({c}x))',
    solution: '利用乘积法则：$y\'={a}[{b}e^{{b}x}\\cos({c}x)+e^{{b}x}\\cdot(-{c}\\sin({c}x))]={a}e^{{b}x}({b}\\cos({c}x)-{c}\\sin({c}x))$',
    questionType: 'essay', difficulty: 2, chapter: '导数与微分',
  },
  {
    content: '求$y=\\ln({a}x^2+{b}x+{c})$的导数$y\'$',
    answer: '(2{a}x+{b})/({a}x^2+{b}x+{c})',
    solution: '利用链式法则：$y\'=\\frac{1}{{a}x^2+{b}x+{c}}\\cdot(2{a}x+{b})$',
    questionType: 'fill_in', difficulty: 2, chapter: '导数与微分',
  },
  {
    content: '求$y=x^{a}e^{{b}x}$的${c}阶导数（n={c}）',
    answer: '见解析',
    solution: '利用莱布尼茨公式，对$x^{a}e^{{b}x}$求高阶导数，先用求导法则递推',
    questionType: 'essay', difficulty: 3, chapter: '导数与微分',
  },
  {
    content: '求由方程$x^{n}+y^{n}={a}$确定的隐函数$y=y(x)$的导数$\\frac{dy}{dx}$',
    answer: '-x^{n-1}/y^{n-1}',
    solution: '两边对$x$求导：$n x^{n-1}+n y^{n-1}\\cdot y\'=0$，得$y\'=-\\frac{x^{n-1}}{y^{n-1}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '导数与微分',
  },
  {
    content: '求参数方程$x={a}t^2,\\ y={b}t^3$所确定的函数$y=y(x)$的导数$\\frac{dy}{dx}$',
    answer: '3{b}t/2{a}',
    solution: '$\\frac{dy}{dx}=\\frac{y\'(t)}{x\'(t)}=\\frac{3{b}t^2}{2{a}t}=\\frac{3{b}t}{2{a}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '导数与微分',
  },
  {
    content: '求函数$y=\\frac{{a}x+{b}}{{c}x+{d}}$的导数$y\'$',
    answer: '{admbc}/({c}x+{d})^2',
    solution: '利用商法则：$y\'=\\frac{{a}({c}x+{d})-({a}x+{b}){c}}{({c}x+{d})^2}=\\frac{{a}{d}-{b}{c}}{({c}x+{d})^2}$',
    questionType: 'fill_in', difficulty: 1, chapter: '导数与微分',
  },
];

const INTEGRAL_TEMPLATES: GenQuestion[] = [
  {
    content: '计算不定积分：$\\int {a}x^{n}\\,dx$',
    answer: '{a}/{n1}x^{n1}+C',
    solution: '利用幂函数积分公式：$\\int x^n dx=\\frac{x^{n+1}}{n+1}+C$，得$\\frac{{a}}{{n1}}x^{{n1}}+C$',
    questionType: 'fill_in', difficulty: 1, chapter: '不定积分',
  },
  {
    content: '计算定积分：$\\int_{0}^{{a}} {b}x^{n}\\,dx$',
    answer: '{b}*{a}^{n1}/{n1}',
    solution: '$\\int_0^{a} {b}x^{n}dx = {b}\\cdot\\frac{x^{n+1}}{n+1}\\big|_0^{a} = \\frac{{b}\\cdot {a}^{n+1}}{n+1}$',
    questionType: 'fill_in', difficulty: 1, chapter: '定积分',
  },
  {
    content: '计算不定积分：$\\int {a}\\cos({b}x)\\,dx$',
    answer: '{a}/{b}sin({b}x)+C',
    solution: '$\\int {a}\\cos({b}x)dx = \\frac{{a}}{{b}}\\sin({b}x)+C$',
    questionType: 'fill_in', difficulty: 1, chapter: '不定积分',
  },
  {
    content: '计算不定积分：$\\int \\frac{{a}}{{b}x+{c}}\\,dx$',
    answer: '{a}/{b}ln|{b}x+{c}|+C',
    solution: '凑微分：$\\int\\frac{{a}}{{b}x+{c}}dx=\\frac{{a}}{{b}}\\int\\frac{d({b}x+{c})}{{b}x+{c}}=\\frac{{a}}{{b}}\\ln|{b}x+{c}|+C$',
    questionType: 'fill_in', difficulty: 2, chapter: '不定积分',
  },
  {
    content: '计算不定积分：$\\int {a}x e^{{b}x}\\,dx$（用分部积分法）',
    answer: '{a}/{b}xe^{bx}-{a}/{b2}e^{bx}+C',
    solution: '令$u={a}x,\\ dv=e^{{b}x}dx$，则$\\int {a}x e^{{b}x}dx=\\frac{{a}}{{b}}xe^{{b}x}-\\frac{{a}}{{b}}\\int e^{{b}x}dx=\\frac{{a}}{{b}}xe^{{b}x}-\\frac{{a}}{{b}^2}e^{{b}x}+C$',
    questionType: 'essay', difficulty: 2, chapter: '不定积分',
  },
  {
    content: '计算定积分：$\\int_{0}^{\\pi/{b}} {a}\\sin({b}x)\\,dx$',
    answer: '2{a}/{b}',
    solution: '$\\int_0^{\\pi/{b}} {a}\\sin({b}x)dx = \\frac{{a}}{{b}}[-\\cos({b}x)]_0^{\\pi/{b}} = \\frac{{a}}{{b}}(-\\cos\\pi+\\cos0)=\\frac{2{a}}{{b}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '定积分',
  },
  {
    content: '计算反常积分：$\\int_{{a}}^{+\\infty}\\frac{1}{x^{n}}\\,dx$（$n>1$）',
    answer: '{a}^{1-n}/({n}-1)',
    solution: '$\\int_a^{\\infty}x^{-n}dx=\\frac{x^{1-n}}{1-n}\\big|_a^{\\infty}=0-\\frac{a^{1-n}}{1-n}=\\frac{a^{1-n}}{n-1}$',
    questionType: 'fill_in', difficulty: 3, chapter: '反常积分',
  },
  {
    content: '计算二重积分：$\\iint_D {a}xy\\,dx\\,dy$，其中$D=[0,{b}]\\times[0,{c}]$',
    answer: '{a}*{b}^2*{c}^2/4',
    solution: '$\\iint_D {a}xy\\,dxdy = {a}\\int_0^{b}xdx\\cdot\\int_0^{c}ydy = {a}\\cdot\\frac{b^2}{2}\\cdot\\frac{c^2}{2}=\\frac{{a}b^2c^2}{4}$',
    questionType: 'fill_in', difficulty: 3, chapter: '二重积分',
  },
];

const LINEAR_ALGEBRA_TEMPLATES: GenQuestion[] = [
  {
    content: '计算行列式 $\\det\\begin{pmatrix}{a}&{b}\\\\{c}&{d}\\end{pmatrix}$',
    answer: '{det}',
    solution: '$\\det=ad-bc={a}\\cdot{d}-{b}\\cdot{c}={det}$',
    questionType: 'fill_in', difficulty: 1, chapter: '行列式',
  },
  {
    content: '计算矩阵乘积：$\\begin{pmatrix}{a}&{b}\\\\{c}&{d}\\end{pmatrix}\\begin{pmatrix}{e}&{f}\\\\{g}&{h}\\end{pmatrix}$ 的第一行第一列元素',
    answer: '{a}*{e}+{b}*{g}',
    solution: '矩阵乘法：$(AB)_{11}=a_{11}b_{11}+a_{12}b_{21}={a}\\cdot{e}+{b}\\cdot{g}$',
    questionType: 'fill_in', difficulty: 1, chapter: '矩阵',
  },
  {
    content: '求矩阵$A=\\begin{pmatrix}{a}&{b}\\\\{c}&{d}\\end{pmatrix}$的逆矩阵$A^{-1}$的第一行第一列元素',
    answer: '{d}/{det}',
    solution: '$A^{-1}=\\frac{1}{ad-bc}\\begin{pmatrix}d&-b\\\\-c&a\\end{pmatrix}$，$(A^{-1})_{11}=\\frac{d}{{det}}$',
    questionType: 'fill_in', difficulty: 2, chapter: '矩阵',
  },
  {
    content: '求矩阵$A=\\begin{pmatrix}{a}&{b}&{c}\\\\{d}&{e}&{f}\\\\{g}&{h}&{i}\\end{pmatrix}$的秩（已知第1行与第2行不成比例，第3行为前两行的线性组合）',
    answer: '2',
    solution: '由于三行线性相关但前两行线性无关，秩为2',
    questionType: 'fill_in', difficulty: 2, chapter: '矩阵',
  },
  {
    content: '求向量组$\\alpha_1=({a},{b},{c}),\\ \\alpha_2=({d},{e},{f})$生成的子空间的维数',
    answer: '2（假设两向量线性无关）',
    solution: '若两向量不成比例，则线性无关，生成的子空间维数为2',
    questionType: 'fill_in', difficulty: 2, chapter: '向量空间',
  },
  {
    content: '解线性方程组：$\\begin{cases}{a}x+{b}y={e}\\\\{c}x+{d}y={f}\\end{cases}$，求$x$的值',
    answer: '({e}*{d}-{b}*{f})/({a}*{d}-{b}*{c})',
    solution: '由克莱姆法则：$x=\\frac{\\det\\begin{pmatrix}e&b\\\\f&d\\end{pmatrix}}{\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}}=\\frac{ed-bf}{ad-bc}$',
    questionType: 'fill_in', difficulty: 2, chapter: '线性方程组',
  },
  {
    content: '设$A$为3阶方阵且$\\det(A)={a}$，求$\\det({b}A)$',
    answer: '{b}^3*{a}',
    solution: '$\\det({b}A)={b}^3\\det(A)={b}^3\\cdot{a}$',
    questionType: 'fill_in', difficulty: 1, chapter: '行列式',
  },
  {
    content: '求矩阵$A=\\begin{pmatrix}{a}&0\\\\0&{b}\\end{pmatrix}$的特征值',
    answer: '{a}和{b}',
    solution: '特征多项式$\\det(A-\\lambda I)=({a}-\\lambda)({b}-\\lambda)=0$，得$\\lambda_1={a},\\ \\lambda_2={b}$',
    questionType: 'fill_in', difficulty: 1, chapter: '特征值与特征向量',
  },
  {
    content: '判断二次型$f(x_1,x_2)={a}x_1^2+{b}x_1x_2+{c}x_2^2$的正定性，其矩阵为$\\begin{pmatrix}{a}&{b}/2\\\\{b}/2&{c}\\end{pmatrix}$',
    answer: '需具体数值判断',
    solution: '二次型正定当且仅当$a>0$且$ac-\\frac{b^2}{4}>0$',
    questionType: 'essay', difficulty: 3, chapter: '二次型',
  },
];

const PROBABILITY_TEMPLATES: GenQuestion[] = [
  {
    content: '设随机变量$X\\sim N({mu},{sigma2})$，求$P(|X-{mu}|<{k})$',
    answer: '2Φ({k}/{sigma})-1',
    solution: '标准化后，$P(|X-{mu}|<{k})=P(\\frac{|X-{mu}|}{{sigma}}<{k}/{sigma})=2\\Phi({k}/{sigma})-1$',
    questionType: 'fill_in', difficulty: 2, chapter: '随机变量',
  },
  {
    content: '设随机变量$X\\sim B({n},{p})$，其中$p$为概率参数，求$E(X)$',
    answer: '{n}*p',
    solution: '二项分布的期望为$E(X)=np$',
    questionType: 'fill_in', difficulty: 1, chapter: '数字特征',
  },
  {
    content: '设随机变量$X$服从参数为${a}$的泊松分布，求$E(X)$和$D(X)$',
    answer: '均为{a}',
    solution: '泊松分布的期望和方差都等于参数${a}$',
    questionType: 'fill_in', difficulty: 1, chapter: '数字特征',
  },
  {
    content: '设随机变量$X$在$[0,{a}]$上服从均匀分布，求$P(X<{b})$',
    answer: '{b}/{a}',
    solution: '均匀分布的概率密度$f(x)=1/{a}$，$P(X<{b})=\\int_0^{b}\\frac{1}{{a}}dx=\\frac{{b}}{{a}}$',
    questionType: 'fill_in', difficulty: 1, chapter: '随机变量',
  },
  {
    content: '设$X$的密度函数为$f(x)=\\begin{cases}{a}x^{n} & 0<x<1 \\\\ 0 & \\text{其他}\\end{cases}$，求$E(X)$',
    answer: '{a}/{n1}',
    solution: '$E(X)=\\int_0^1 x\\cdot {a}x^{n}dx = {a}\\int_0^1 x^{n+1}dx = \\frac{{a}}{n+2}$',
    questionType: 'fill_in', difficulty: 2, chapter: '数字特征',
  },
  {
    content: '设随机变量$X$的数学期望为${mu}$，方差为${sigma2}$，由切比雪夫不等式估计$P(|X-{mu}|\\ge {k})$的上界',
    answer: '{sigma2}/{k}^2',
    solution: '切比雪夫不等式：$P(|X-E(X)|\\ge\\varepsilon)\\le\\frac{D(X)}{\\varepsilon^2}=\\frac{\\sigma^2}{k^2}$',
    questionType: 'fill_in', difficulty: 2, chapter: '大数定律',
  },
  {
    content: '袋中有${a}$个红球和${b}$个白球，随机取出${c}$个球，求恰好取出${d}$个红球的概率',
    answer: 'C({a},{d})*C({b},{c-d})/C({a+b},{c})',
    solution: '超几何分布：$P=\\frac{C_a^d C_b^{c-d}}{C_{a+b}^c}$',
    questionType: 'fill_in', difficulty: 2, chapter: '随机事件与概率',
  },
  {
    content: '设$(X,Y)$的联合密度为$f(x,y)={a}$（$0<x<{b},\\ 0<y<{c}$），求协方差$\\operatorname{Cov}(X,Y)$',
    answer: '0',
    solution: '当$X,Y$相互独立且服从矩形区域上的均匀分布时，$\\operatorname{Cov}(X,Y)=0$',
    questionType: 'fill_in', difficulty: 2, chapter: '数字特征',
  },
];

function fillTemplate(template: string, vars: Record<string, number>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function simplifyFraction(num: number, den: number): string {
  if (num === 0) return '0';
  if (den === 1) return String(num);
  if (num % den === 0) return String(num / den);
  const gcd = (a: number, b: number): number => b === 0 ? Math.abs(a) : gcd(b, a % b);
  const d = gcd(Math.abs(num), den);
  const n = num / d;
  const de = den / d;
  return de === 1 ? String(n) : `${n}/${de}`;
}

export function generateMathQuestions(
  category: string,
  count: number,
  difficulty?: number,
  chapter?: string
): GenQuestion[] {
  const results: GenQuestion[] = [];

  let templates: GenQuestion[] = [];
  if (category === '高等数学' || category === 'gaoshu') {
    templates = [...LIMIT_TEMPLATES, ...DERIVATIVE_TEMPLATES, ...INTEGRAL_TEMPLATES];
  } else if (category === '线性代数' || category === 'xiandai') {
    templates = [...LINEAR_ALGEBRA_TEMPLATES];
  } else if (category === '概率论与数理统计' || category === 'gailv') {
    templates = [...PROBABILITY_TEMPLATES];
  } else {
    templates = [...LIMIT_TEMPLATES, ...DERIVATIVE_TEMPLATES, ...INTEGRAL_TEMPLATES, ...LINEAR_ALGEBRA_TEMPLATES, ...PROBABILITY_TEMPLATES];
  }

  if (difficulty) {
    templates = templates.filter(t => t.difficulty === difficulty);
  }

  if (chapter) {
    templates = templates.filter(t => t.chapter === chapter);
  }

  for (let i = 0; i < count; i++) {
    const template = pick(templates);
    const a = randInt(1, 6);
    const b = randInt(1, 6);
    const c = randInt(1, 5);
    const d = randInt(1, 8);
    const e = randInt(1, 8);
    const f = randInt(1, 8);
    const g = randInt(1, 8);
    const h = randInt(1, 8);
    const m = randInt(2, 5);
    const n = randInt(2, 5);
    const mu = randInt(1, 10);
    const sigma = randInt(1, 3);
    const sigma2 = sigma * sigma;
    const k = randInt(1, 3);
    const p = Math.round((randInt(1, 9) / 10) * 10) / 10 || 0.3;

    const a2 = a * a;
    const a3 = a * a * a;
    const ab = a * b;
    const n1 = n + 1;
    const an = a * n;
    const anm1 = a * (n - 1);
    const bc = b * c;
    const det = a * d - b * c;
    const admbc = a * d - b * c;
    const b2 = b * b;

    const vars: Record<string, number> = {
      a, b, c, d, e, f, g, h, m, n, n1, an, anm1, a2, a3, ab, bc, det, admbc, b2,
      mu, sigma, sigma2, k, p,
    };

    const content = fillTemplate(template.content, vars);
    const answer = fillTemplate(template.answer, vars)
      .replace(/e\^\{(\d+)\/(\d+)\}/g, (_, num, den) => `e^{${simplifyFraction(Number(num), Number(den))}}`)
      .replace(/e\^\{(\d+)\}/g, (_, num) => `e^{${num}}`);
    const solution = fillTemplate(template.solution, vars)
      .replace(/e\^\{(\d+)\/(\d+)\}/g, (_, num, den) => `e^{${simplifyFraction(Number(num), Number(den))}}`)
      .replace(/e\^\{(\d+)\}/g, (_, num) => `e^{${num}}`);

    results.push({
      content,
      answer,
      solution,
      questionType: template.questionType,
      difficulty: template.difficulty,
      chapter: template.chapter,
      knowledgePoints: template.chapter ? [template.chapter] : [],
    });
  }

  return results;
}

export function getAvailableChapters(category: string): string[] {
  let templates: GenQuestion[] = [];
  if (category === '高等数学' || category === 'gaoshu') {
    templates = [...LIMIT_TEMPLATES, ...DERIVATIVE_TEMPLATES, ...INTEGRAL_TEMPLATES];
  } else if (category === '线性代数' || category === 'xiandai') {
    templates = [...LINEAR_ALGEBRA_TEMPLATES];
  } else if (category === '概率论与数理统计' || category === 'gailv') {
    templates = [...PROBABILITY_TEMPLATES];
  } else {
    templates = [...LIMIT_TEMPLATES, ...DERIVATIVE_TEMPLATES, ...INTEGRAL_TEMPLATES, ...LINEAR_ALGEBRA_TEMPLATES, ...PROBABILITY_TEMPLATES];
  }
  const chapters = new Set(templates.filter(t => t.chapter).map(t => t.chapter!));
  return [...chapters];
}

export const EXTERNAL_BOOKS = [
  {
    name: '考研数学复习全书',
    publisher: '李永乐·王式安',
    year: 2024,
    description: '考研数学最经典的复习用书，覆盖全部考点',
    questionCount: 660,
  },
  {
    name: '数学基础过关660题',
    publisher: '李永乐·王式安',
    year: 2024,
    description: '基础题型强化训练，选择题+填空题共660道',
    questionCount: 660,
  },
  {
    name: '张宇考研数学1000题',
    publisher: '张宇',
    year: 2024,
    description: '分为A/B/C三组难度递进，覆盖全部考点',
    questionCount: 1000,
  },
  {
    name: '汤家凤1800题',
    publisher: '汤家凤',
    year: 2024,
    description: '基础篇+提高篇共1800题，循序渐进',
    questionCount: 1800,
  },
  {
    name: '历年考研数学真题（1987-2024）',
    publisher: '教育部考试中心',
    year: 2024,
    description: '历年真题合集，含数一/数二/数三全部真题',
    questionCount: 900,
  },
  {
    name: '合工大五套卷',
    publisher: '合肥工业大学',
    year: 2024,
    description: '高质量模拟卷，贴近真题风格',
    questionCount: 110,
  },
  {
    name: '李林六套卷+四套卷',
    publisher: '李林',
    year: 2024,
    description: '考前冲刺模拟卷，押题命中率高',
    questionCount: 220,
  },
];