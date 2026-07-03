/**
 * 大规模题库生成 - 利用模板变体生成 5000+ 道题
 */

import * as fs from 'fs';
import * as path from 'path';

interface Question {
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

// 随机整数
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 随机选择
function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 最大公约数
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

// 格式化分数（LaTeX 形式）
function formatFrac(num: number, den: number): string {
  if (den === 0) return '\\infty';
  if (den === 1) return `${num}`;
  if (num % den === 0) return `${num / den}`;
  const g = gcd(Math.abs(num), Math.abs(den));
  const n = Math.abs(num) / g;
  const d = Math.abs(den) / g;
  const sign = (num < 0 && den > 0) || (num > 0 && den < 0) ? '-' : '';
  if (d === 1) return `${sign}${n}`;
  return `${sign}\\frac{${n}}{${d}}`;
}

// ========== 第一章：函数、极限、连续 ==========

function genCh1(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  // 1.1 定义域 - 生成大量变体（原有 4 种模式，迭代替换为 50 次）
  const domainPatterns = [
    { expr: (a: number, b: number) => `\\sqrt{${a}x-${b}}`, ans: (a: number, b: number) => `[${b/a}, +\\infty)`, sol: (a: number, b: number) => `需 ${a}x-${b} \\geq 0，即 x \\geq ${b/a}` },
    { expr: (a: number) => `\\ln(${a}-x^2)`, ans: (a: number) => `(-\\sqrt{${a}}, \\sqrt{${a}})`, sol: (a: number) => `需 ${a}-x^2 > 0，即 |x| < \\sqrt{${a}}` },
    { expr: (a: number) => `\\frac{1}{\\sqrt{x^2-${a}}}`, ans: (a: number) => `(-\\infty, -\\sqrt{${a}}) \\cup (\\sqrt{${a}}, +\\infty)`, sol: (a: number) => `需 x^2-${a} > 0，即 |x| > \\sqrt{${a}}` },
    { expr: (a: number, b: number) => `\\arcsin(${a}x-${b})`, ans: (a: number, b: number) => `[${(b-1)/a}, ${(b+1)/a}]`, sol: (a: number, b: number) => `需 -1 \\leq ${a}x-${b} \\leq 1，即 ${b-1} \\leq ${a}x \\leq ${b+1}` },
  ];

  for (const pat of domainPatterns) {
    for (let i = 0; i < 50; i++) {
      const a = randInt(1, 9);
      const b = randInt(1, 9);
      id++;
      const content = `求函数 $f(x) = ${pat.expr(a, b)}$ 的定义域。`;
      const answer = pat.ans(a, b);
      const solution = pat.sol(a, b);
      qs.push({
        id: `math-ch1-${String(id).padStart(4, '0')}`,
        type: 'fill_in',
        difficulty: 1,
        chapter: '函数、极限、连续',
        section: '函数的概念与特性',
        knowledge_points: ['kp-1-1-1'],
        title: '函数定义域',
        content,
        answer,
        solution,
        hints: ['考虑函数有意义的条件', '注意分母不为零、根号内非负、对数真数大于零'],
        tags: ['定义域', '初等函数'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 1.1 新增定义域模式
  const domainPatterns2 = [
    {
      expr: (a: number) => `\\frac{1}{\\ln(x-${a})}`,
      ans: (a: number) => `(${a}, ${a+1}) \\cup (${a+1}, +\\infty)`,
      sol: (a: number) => `需 $x-${a} > 0$ 且 $x-${a} \\neq 1$，即 $x > ${a}$ 且 $x \\neq ${a+1}$`,
    },
    {
      expr: (a: number) => `\\sqrt{${a}-x^2}`,
      ans: (a: number) => `[-\\sqrt{${a}}, \\sqrt{${a}}]`,
      sol: (a: number) => `需 ${a}-x^2 \\geq 0，即 |x| \\leq \\sqrt{${a}}`,
    },
    {
      expr: (a: number) => `\\frac{x}{\\sqrt{x^2-${a}^2}}`,
      ans: (a: number) => `(-\\infty, -${a}) \\cup (${a}, +\\infty)`,
      sol: (a: number) => `需 $x^2-${a}^2 > 0$，即 $|x| > ${a}$`,
    },
    {
      expr: (a: number, b: number) => `\\arccos(${a}x-${b})`,
      ans: (a: number, b: number) => `[${(b-1)/a}, ${(b+1)/a}]`,
      sol: (a: number, b: number) => `需 $-1 \\leq ${a}x-${b} \\leq 1$，即 $\\frac{${b-1}}{${a}} \\leq x \\leq \\frac{${b+1}}{${a}}$`,
    },
  ];

  for (const pat of domainPatterns2) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 9);
      const b = randInt(1, 9);
      id++;
      const content = `求函数 $f(x) = ${pat.expr(a, b)}$ 的定义域。`;
      const answer = pat.ans(a, b);
      const solution = pat.sol(a, b);
      qs.push({
        id: `math-ch1-${String(id).padStart(4, '0')}`,
        type: 'fill_in',
        difficulty: 1,
        chapter: '函数、极限、连续',
        section: '函数的概念与特性',
        knowledge_points: ['kp-1-1-1'],
        title: '函数定义域',
        content,
        answer,
        solution,
        hints: ['考虑函数有意义的条件', '注意分母不为零、根号内非负、对数真数大于零'],
        tags: ['定义域', '初等函数'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 1.2 数列极限 - 大量变体（原有 4 种模式，迭代替换为 40 次）
  const seqLimitPatterns = [
    { 
      content: (a: number, b: number, c: number, d: number, e: number, f: number) => 
        `求极限 $\\lim_{n \\to \\infty} \\frac{${a}n^2 + ${b}n + ${c}}{${d}n^2 + ${e}n + ${f}}$`,
      answer: (a: number, d: number) => d !== 0 ? `$${formatFrac(a, d)}$` : '发散',
      solution: (a: number, b: number, c: number, d: number, e: number, f: number) => 
        `分子分母同除以 $n^2$：$\\lim_{n \\to \\infty} \\frac{${a} + \\frac{${b}}{n} + \\frac{${c}}{n^2}}{${d} + \\frac{${e}}{n} + \\frac{${f}}{n^2}} = \\frac{${a}}{${d}}$`,
      kp: ['kp-1-3-1'],
      title: '数列极限',
      section: '数列极限',
      diff: 1,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{n \\to \\infty} (\\sqrt{n^2+${a}n} - n)$`,
      answer: (a: number) => `$${formatFrac(a, 2)}$`,
      solution: (a: number) => `有理化：$\\lim_{n \\to \\infty} \\frac{(n^2+${a}n) - n^2}{\\sqrt{n^2+${a}n} + n} = \\lim_{n \\to \\infty} \\frac{${a}n}{\\sqrt{n^2+${a}n} + n} = \\frac{${a}}{2}$`,
      kp: ['kp-1-3-4'],
      title: '数列极限-有理化',
      section: '数列极限',
      diff: 2,
    },
    {
      content: (a: number) => `求极限 $\\lim_{n \\to \\infty} \\left(1 + \\frac{${a}}{n}\\right)^n$`,
      answer: (a: number) => `$e^{${a}}$`,
      solution: (a: number) => `利用重要极限：$\\lim_{n \\to \\infty} (1+\\frac{${a}}{n})^n = \\lim_{n \\to \\infty} \\left[(1+\\frac{${a}}{n})^{\\frac{n}{${a}}}\\right]^{${a}} = e^{${a}}$`,
      kp: ['kp-1-3-3'],
      title: '重要极限',
      section: '数列极限',
      diff: 2,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{n \\to \\infty} \\frac{${a}^n + ${b}^n}{${a}^{n+1}}$`,
      answer: (a: number) => a > 1 ? `$${formatFrac(1, a)}$` : '发散',
      solution: (a: number, b: number) => `分子分母同除以 ${a}^n：$\\lim_{n \\to \\infty} \\frac{1 + (${b}/${a})^n}{${a}} = \\frac{1}{${a}}$（当 ${b}<${a} 时 $(\\frac{${b}}{${a}})^n \\to 0$）`,
      kp: ['kp-1-3-1'],
      title: '指数型数列极限',
      section: '数列极限',
      diff: 2,
    },
  ];

  for (const pat of seqLimitPatterns) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 9);
      const b = randInt(1, 9);
      const c = randInt(0, 5);
      const d = randInt(1, 9);
      const e = randInt(0, 5);
      const f = randInt(0, 5);
      id++;
      qs.push({
        id: `math-ch1-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '函数、极限、连续',
        section: pat.section,
        knowledge_points: pat.kp,
        title: pat.title,
        content: pat.content(a, b, c, d, e, f),
        answer: pat.answer(a, d),
        solution: pat.solution(a, b, c, d, e, f),
        hints: ['分子分母同除以最高次项', '使用夹逼准则或重要极限'],
        tags: ['数列极限', '极限计算'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 1.3 函数极限 - 大量变体（原有 7 种模式，迭代替换为 40 次）
  const funcLimitPatterns = [
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{\\sin ${a}x}{x}$`,
      answer: (a: number) => `$${a}$`,
      solution: (a: number) => `$\\lim_{x \\to 0} \\frac{\\sin ${a}x}{x} = \\lim_{x \\to 0} ${a} \\cdot \\frac{\\sin ${a}x}{${a}x} = ${a}$`,
      kp: ['kp-1-4-5'],
      title: '第一个重要极限',
      diff: 1,
    },
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{\\tan ${a}x}{x}$`,
      answer: (a: number) => `$${a}$`,
      solution: (a: number) => `$\\lim_{x \\to 0} \\frac{\\tan ${a}x}{x} = \\lim_{x \\to 0} ${a} \\cdot \\frac{\\tan ${a}x}{${a}x} = ${a}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 1,
    },
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{1-\\cos ${a}x}{x^2}$`,
      answer: (a: number) => `$${formatFrac(a*a, 2)}$`,
      solution: (a: number) => `$1-\\cos ${a}x = 2\\sin^2\\frac{${a}x}{2} \\sim 2 \\cdot (\\frac{${a}x}{2})^2 = \\frac{${a}^2 x^2}{2}$，故极限为 $\\frac{${a}^2}{2}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 2,
    },
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{e^{${a}x} - 1}{x}$`,
      answer: (a: number) => `$${a}$`,
      solution: (a: number) => `$e^{${a}x} - 1 \\sim ${a}x$，故 $\\lim_{x \\to 0} \\frac{e^{${a}x} - 1}{x} = ${a}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 1,
    },
    {
      content: (a: number) => `求极限 $\\lim_{x \\to \\infty} (1+\\frac{${a}}{x})^x$`,
      answer: (a: number) => `$e^{${a}}$`,
      solution: (a: number) => `$\\lim_{x \\to \\infty} (1+\\frac{${a}}{x})^x = \\lim_{x \\to \\infty} \\left[(1+\\frac{${a}}{x})^{\\frac{x}{${a}}}\\right]^{${a}} = e^{${a}}$`,
      kp: ['kp-1-4-7'],
      title: '第二个重要极限',
      diff: 2,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{x \\to 0} \\frac{\\ln(1+${a}x)}{${b}x}$`,
      answer: (a: number, b: number) => `$${formatFrac(a, b)}$`,
      solution: (a: number, b: number) => `$\\ln(1+${a}x) \\sim ${a}x$，故 $\\lim_{x \\to 0} \\frac{\\ln(1+${a}x)}{${b}x} = \\frac{${a}}{${b}}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 1,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{x \\to \\infty} \\left(\\frac{x+${a}}{x-${b}}\\right)^x$`,
      answer: (a: number, b: number) => `$e^{${a+b}}$`,
      solution: (a: number, b: number) => `$\\left(\\frac{x+${a}}{x-${b}}\\right)^x = \\left(1+\\frac{${a+b}}{x-${b}}\\right)^x = \\left[\\left(1+\\frac{${a+b}}{x-${b}}\\right)^{\\frac{x-${b}}{${a+b}}}\\right]^{\\frac{${a+b}x}{x-${b}}} \\to e^{${a+b}}$`,
      kp: ['kp-1-4-7'],
      title: '重要极限变形',
      diff: 3,
    },
  ];

  for (const pat of funcLimitPatterns) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 6);
      const b = randInt(1, 6);
      id++;
      qs.push({
        id: `math-ch1-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '函数、极限、连续',
        section: '函数极限',
        knowledge_points: pat.kp,
        title: pat.title,
        content: pat.content(a, b),
        answer: pat.answer(a, b),
        solution: pat.solution(a, b),
        hints: ['使用等价无穷小替换', '或使用重要极限'],
        tags: ['函数极限', '等价无穷小', '重要极限'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 1.3 新增函数极限模式
  const funcLimitPatterns2 = [
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{\\arcsin ${a}x}{x}$`,
      answer: (a: number) => `$${a}$`,
      solution: (a: number) => `$\\arcsin ${a}x \\sim ${a}x$（$x \\to 0$），故 $\\lim_{x \\to 0} \\frac{\\arcsin ${a}x}{x} = ${a}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 1,
    },
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{\\arctan ${a}x}{x}$`,
      answer: (a: number) => `$${a}$`,
      solution: (a: number) => `$\\arctan ${a}x \\sim ${a}x$（$x \\to 0$），故 $\\lim_{x \\to 0} \\frac{\\arctan ${a}x}{x} = ${a}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 1,
    },
    {
      content: (a: number) => `求极限 $\\lim_{x \\to 0} \\frac{${a}^x - 1}{x}$`,
      answer: (a: number) => `$\\ln ${a}$`,
      solution: (a: number) => `$a^x - 1 \\sim x \\ln a$（$x \\to 0$），故 $\\lim_{x \\to 0} \\frac{${a}^x - 1}{x} = \\ln ${a}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 2,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{x \\to 0} \\frac{\\sin ${a}x - \\sin ${b}x}{x}$`,
      answer: (a: number, b: number) => `$${a-b}$`,
      solution: (a: number, b: number) => `$\\sin ${a}x \\sim ${a}x$，$\\sin ${b}x \\sim ${b}x$，故 $\\lim_{x \\to 0} \\frac{\\sin ${a}x - \\sin ${b}x}{x} = ${a}-${b} = ${a-b}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 2,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{x \\to \\infty} \\frac{${a}x^3 + ${b}x^2 + ${a}x + ${b}}{${b}x^3 + ${a}x^2 + ${b}x + ${a}}$`,
      answer: (a: number, b: number) => `$${formatFrac(a, b)}$`,
      solution: (a: number, b: number) => `分子分母同除以 $x^3$：$\\lim_{x \\to \\infty} \\frac{${a} + \\frac{${b}}{x} + \\frac{${a}}{x^2} + \\frac{${b}}{x^3}}{${b} + \\frac{${a}}{x} + \\frac{${b}}{x^2} + \\frac{${a}}{x^3}} = \\frac{${a}}{${b}}$`,
      kp: ['kp-1-4-1'],
      title: '有理函数极限',
      diff: 1,
    },
    {
      content: (a: number, b: number) => `求极限 $\\lim_{x \\to 0} \\frac{1-\\cos ${a}x}{1-\\cos ${b}x}$`,
      answer: (a: number, b: number) => `$${formatFrac(a*a, b*b)}$`,
      solution: (a: number, b: number) => `$1-\\cos ${a}x \\sim \\frac{${a}^2 x^2}{2}$，$1-\\cos ${b}x \\sim \\frac{${b}^2 x^2}{2}$，故极限为 $\\frac{${a}^2}{${b}^2}$`,
      kp: ['kp-1-4-5'],
      title: '等价无穷小',
      diff: 2,
    },
  ];

  for (const pat of funcLimitPatterns2) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 6);
      const b = randInt(1, 6);
      id++;
      qs.push({
        id: `math-ch1-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '函数、极限、连续',
        section: '函数极限',
        knowledge_points: pat.kp,
        title: pat.title,
        content: pat.content(a, b),
        answer: pat.answer(a, b),
        solution: pat.solution(a, b),
        hints: ['使用等价无穷小替换', '或使用重要极限'],
        tags: ['函数极限', '等价无穷小', '重要极限'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 1.4 间断点分类（原有 10 次，增加到 35 次）
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch1-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '函数、极限、连续',
      section: '函数的连续性',
      knowledge_points: ['kp-1-5-2'],
      title: '间断点分类',
      content: `讨论函数 $f(x) = \\frac{x^2-${a*a}}{x-${a}}$ 在 $x=${a}$ 处的间断点类型。`,
      answer: `$x=${a}$ 为可去间断点`,
      solution: `$\\lim_{x \\to ${a}} \\frac{x^2-${a*a}}{x-${a}} = \\lim_{x \\to ${a}} (x+${a}) = ${2*a}$，极限存在但 $f(${a})$ 无定义，故为可去间断点。`,
      hints: ['因式分解', '计算极限'],
      tags: ['间断点', '连续性'],
      source: '基础题库',
      year: null,
    });
  }

  // 1.4 新增间断点类型
  for (let i = 0; i < 25; i++) {
    const a = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch1-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '函数、极限、连续',
      section: '函数的连续性',
      knowledge_points: ['kp-1-5-2'],
      title: '跳跃间断点',
      content: `讨论函数 $f(x) = \\begin{cases} x+${a}, & x<0 \\\\ x-${a}, & x \\geq 0 \\end{cases}$ 在 $x=0$ 处的连续性。`,
      answer: `$x=0$ 为跳跃间断点，跳跃度为 ${2*a}$`,
      solution: `$\\lim_{x \\to 0^-} f(x) = ${a}$，$\\lim_{x \\to 0^+} f(x) = -${a}$，左右极限不相等，故为跳跃间断点，跳跃度为 ${a}-(-${a}) = ${2*a}$。`,
      hints: ['分别计算左右极限', '比较左右极限是否相等'],
      tags: ['间断点', '连续性'],
      source: '基础题库',
      year: null,
    });
  }

  for (let i = 0; i < 25; i++) {
    const a = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch1-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '函数、极限、连续',
      section: '函数的连续性',
      knowledge_points: ['kp-1-5-2'],
      title: '无穷间断点',
      content: `讨论函数 $f(x) = \\frac{1}{(x-${a})^2}$ 在 $x=${a}$ 处的间断点类型。`,
      answer: `$x=${a}$ 为无穷间断点（第二类间断点）`,
      solution: `$\\lim_{x \\to ${a}} \\frac{1}{(x-${a})^2} = +\\infty$，极限不存在且趋于无穷，故为第二类无穷间断点。`,
      hints: ['计算极限值', '判断极限是否为无穷大'],
      tags: ['间断点', '无穷间断点'],
      source: '基础题库',
      year: null,
    });
  }

  for (let i = 0; i < 25; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const c = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch1-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '函数、极限、连续',
      section: '函数的连续性',
      knowledge_points: ['kp-1-5-2'],
      title: '连续性参数确定',
      content: `确定常数 $a$，使函数 $f(x) = \\begin{cases} ${b}x+${c}, & x<${a} \\\\ x^2, & x \\geq ${a} \\end{cases}$ 在 $x=${a}$ 处连续。`,
      answer: `$a = ${a*a - b*a - c}$ 时连续`,
      solution: `连续条件：$\\lim_{x \\to ${a}^-} f(x) = \\lim_{x \\to ${a}^+} f(x) = f(${a})$。即 ${b} \\cdot ${a} + ${c} = ${a}^2$，解得 $a$ 需要满足 $a^2 - ${b}a - ${c} = 0$。`,
      hints: ['利用连续的定义：左右极限相等且等于函数值'],
      tags: ['连续性', '参数确定'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第二章：一元函数微分学 ==========

function genCh2(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  // 求导运算 - 大量变体（原有 8 种模式，迭代替换为 50 次）
  const derivPatterns = [
    {
      content: (a: number, n: number) => `求 $y = ${a}x^{${n}}$ 的导数`,
      answer: (a: number, n: number) => `$y' = ${a*n}x^{${n-1}}$`,
      solution: (a: number, n: number) => `$y' = ${a} \\cdot ${n} x^{${n-1}} = ${a*n}x^{${n-1}}$`,
      diff: 1,
      section: '求导法则',
      kp: ['kp-2-2-1'],
    },
    {
      content: (a: number, n: number) => `求 $y = ${a}e^{${n}x}$ 的导数`,
      answer: (a: number, n: number) => `$y' = ${a*n}e^{${n}x}$`,
      solution: (a: number, n: number) => `$y' = ${a} \\cdot ${n} e^{${n}x} = ${a*n}e^{${n}x}$`,
      diff: 1,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = ${a}\\sin ${n}x$ 的导数`,
      answer: (a: number, n: number) => `$y' = ${a*n}\\cos ${n}x$`,
      solution: (a: number, n: number) => `$y' = ${a} \\cdot ${n} \\cos ${n}x = ${a*n}\\cos ${n}x$`,
      diff: 1,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = ${a}\\ln ${n}x$ 的导数`,
      answer: (a: number) => `$y' = \\frac{${a}}{x}$`,
      solution: (a: number, n: number) => `$y' = ${a} \\cdot \\frac{${n}}{${n}x} = \\frac{${a}}{x}$`,
      diff: 1,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = x^{${a}}e^{${n}x}$ 的导数`,
      answer: (a: number, n: number) => `$y' = x^{${a-1}}e^{${n}x}(${a} + ${n}x)$`,
      solution: (a: number, n: number) => `乘积法则：$y' = ${a}x^{${a-1}}e^{${n}x} + x^{${a}} \\cdot ${n}e^{${n}x} = x^{${a-1}}e^{${n}x}(${a} + ${n}x)$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = \\frac{${a}x}{\\sin ${n}x}$ 的导数`,
      answer: (a: number, n: number) => `$y' = \\frac{${a}\\sin ${n}x - ${a*n}x\\cos ${n}x}{\\sin^2 ${n}x}$`,
      solution: (a: number, n: number) => `商的求导法则：$(\\frac{u}{v})' = \\frac{u'v - uv'}{v^2}$。$u=${a}x, u'=${a}$；$v=\\sin ${n}x, v'=${n}\\cos ${n}x$。$y' = \\frac{${a}\\sin ${n}x - ${a}x \\cdot ${n}\\cos ${n}x}{\\sin^2 ${n}x}$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = \\tan(${a}x + ${n})$ 的导数`,
      answer: (a: number, n: number) => `$y' = ${a}\\sec^2(${a}x + ${n})$`,
      solution: (a: number, n: number) => `链式法则：$y' = \\sec^2(${a}x + ${n}) \\cdot ${a} = ${a}\\sec^2(${a}x + ${n})$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-8'],
    },
    {
      content: (a: number, n: number) => `求 $y = \\arcsin(${a}x - ${n})$ 的导数`,
      answer: (a: number, n: number) => `$y' = \\frac{${a}}{\\sqrt{1-(${a}x-${n})^2}}$`,
      solution: (a: number, n: number) => `链式法则：$y' = \\frac{1}{\\sqrt{1-(${a}x-${n})^2}} \\cdot ${a} = \\frac{${a}}{\\sqrt{1-(${a}x-${n})^2}}$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-8'],
    },
  ];

  for (const pat of derivPatterns) {
    for (let i = 0; i < 50; i++) {
      const a = randInt(1, 5);
      const n = randInt(2, 6);
      id++;
      qs.push({
        id: `math-ch2-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '一元函数微分学',
        section: pat.section,
        knowledge_points: pat.kp,
        title: '求导运算',
        content: pat.content(a, n),
        answer: pat.answer(a, n),
        solution: pat.solution(a, n),
        hints: ['使用基本求导公式', '注意链式法则和乘积法则'],
        tags: ['求导', '链式法则'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 新增求导模式
  const derivPatterns2 = [
    {
      content: (a: number) => `求 $y = \\arctan ${a}x$ 的导数`,
      answer: (a: number) => `$y' = \\frac{${a}}{1+${a}^2 x^2}$`,
      solution: (a: number) => `$(\\arctan ${a}x)' = \\frac{${a}}{1+(${a}x)^2} = \\frac{${a}}{1+${a}^2 x^2}$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-8'],
    },
    {
      content: (a: number, n: number) => `求 $y = \\ln(${a}x^2 + ${n})$ 的导数`,
      answer: (a: number, n: number) => `$y' = \\frac{${2*a}x}{${a}x^2+${n}}$`,
      solution: (a: number, n: number) => `链式法则：$y' = \\frac{1}{${a}x^2+${n}} \\cdot ${2*a}x = \\frac{${2*a}x}{${a}x^2+${n}}$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-8'],
    },
    {
      content: (a: number, n: number) => `求 $y = e^{${a}x}\\sin ${n}x$ 的导数`,
      answer: (a: number, n: number) => `$y' = e^{${a}x}(${a}\\sin ${n}x + ${n}\\cos ${n}x)$`,
      solution: (a: number, n: number) => `乘积法则：$y' = ${a}e^{${a}x}\\sin ${n}x + e^{${a}x} \\cdot ${n}\\cos ${n}x = e^{${a}x}(${a}\\sin ${n}x + ${n}\\cos ${n}x)$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = x^{${a}}\\ln ${n}x$ 的导数`,
      answer: (a: number, n: number) => `$y' = x^{${a-1}}(${a}\\ln ${n}x + 1)$`,
      solution: (a: number, n: number) => `乘积法则：$y' = ${a}x^{${a-1}}\\ln ${n}x + x^{${a}} \\cdot \\frac{1}{x} = x^{${a-1}}(${a}\\ln ${n}x + 1)$`,
      diff: 2,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
    {
      content: (a: number, n: number) => `求 $y = \\frac{e^{${a}x}}{x^{${n}}}$ 的导数`,
      answer: (a: number, n: number) => `$y' = \\frac{e^{${a}x}(${a}x - ${n})}{x^{${n+1}}}$`,
      solution: (a: number, n: number) => `商的求导法则：$y' = \\frac{${a}e^{${a}x} \\cdot x^{${n}} - e^{${a}x} \\cdot ${n}x^{${n-1}}}{x^{${2*n}}} = \\frac{e^{${a}x}(${a}x - ${n})}{x^{${n+1}}}$`,
      diff: 3,
      section: '求导法则',
      kp: ['kp-2-2-4'],
    },
  ];

  for (const pat of derivPatterns2) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 5);
      const n = randInt(2, 6);
      id++;
      qs.push({
        id: `math-ch2-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '一元函数微分学',
        section: pat.section,
        knowledge_points: pat.kp,
        title: '求导运算',
        content: pat.content(a, n),
        answer: pat.answer(a, n),
        solution: pat.solution(a, n),
        hints: ['使用基本求导公式', '注意链式法则和乘积法则'],
        tags: ['求导', '链式法则'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 隐函数求导（原有 10 次，增加到 40 次）
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch2-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '一元函数微分学',
      section: '隐函数与参数方程求导',
      knowledge_points: ['kp-2-2-12'],
      title: '隐函数求导',
      content: `设 $y = y(x)$ 由方程 $x^{${a}} + y^{${b}} = ${c}$ 确定，求 $y'$。`,
      answer: `$y' = -\\frac{${a}x^{${a-1}}}{${b}y^{${b-1}}}$`,
      solution: `两边对 $x$ 求导：$${a}x^{${a-1}} + ${b}y^{${b-1}} \\cdot y' = 0$，解得 $y' = -\\frac{${a}x^{${a-1}}}{${b}y^{${b-1}}}$。`,
      hints: ['两边对 $x$ 求导', '注意 $y$ 是 $x$ 的函数'],
      tags: ['隐函数求导'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：参数方程求导
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    const m = randInt(2, 4);
    const n = randInt(2, 4);
    id++;
    qs.push({
      id: `math-ch2-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '一元函数微分学',
      section: '隐函数与参数方程求导',
      knowledge_points: ['kp-2-2-13'],
      title: '参数方程求导',
      content: `设参数方程 $\\begin{cases} x = ${a}t^{${m}} \\\\ y = ${b}t^{${n}} \\end{cases}$，求 $\\frac{dy}{dx}$。`,
      answer: `$\\frac{dy}{dx} = \\frac{${b*n}}{${a*m}} t^{${n-m}}$`,
      solution: `$\\frac{dx}{dt} = ${a*m}t^{${m-1}}$，$\\frac{dy}{dt} = ${b*n}t^{${n-1}}$。$\\frac{dy}{dx} = \\frac{dy/dt}{dx/dt} = \\frac{${b*n}t^{${n-1}}}{${a*m}t^{${m-1}}} = \\frac{${b*n}}{${a*m}} t^{${n-m}}$。`,
      hints: ['使用参数方程求导公式 $\\frac{dy}{dx} = \\frac{dy/dt}{dx/dt}$'],
      tags: ['参数方程求导'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：对数求导法
  for (let i = 0; i < 30; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch2-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '一元函数微分学',
      section: '求导法则',
      knowledge_points: ['kp-2-2-14'],
      title: '对数求导法',
      content: `使用对数求导法求 $y = x^{${a}x}$ 的导数。`,
      answer: `$y' = x^{${a}x} \\cdot ${a}(\\ln x + 1)$`,
      solution: `取对数：$\\ln y = ${a}x \\ln x$。两边求导：$\\frac{y'}{y} = ${a}\\ln x + ${a}$。故 $y' = y \\cdot ${a}(\\ln x + 1) = x^{${a}x} \\cdot ${a}(\\ln x + 1)$。`,
      hints: ['取对数 $\\ln y = f(x) \\ln g(x)$', '两边求导'],
      tags: ['对数求导法'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：高阶导数
  for (let i = 0; i < 30; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch2-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '一元函数微分学',
      section: '求导法则',
      knowledge_points: ['kp-2-2-15'],
      title: '二阶导数',
      content: `求 $y = ${a}x^{${b}} + e^{${a}x}$ 的二阶导数 $y''$。`,
      answer: `$y'' = ${a*b*(b-1)}x^{${b-2}} + ${a*a}e^{${a}x}$`,
      solution: `$y' = ${a*b}x^{${b-1}} + ${a}e^{${a}x}$，$y'' = ${a*b*(b-1)}x^{${b-2}} + ${a*a}e^{${a}x}$。`,
      hints: ['先求一阶导数', '再对一阶导数求导'],
      tags: ['高阶导数', '二阶导数'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第三章：微分中值定理与导数的应用 ==========

function genCh3(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  // 洛必达法则 - 大量变体（原有 15 次，增加到 60 次）
  for (let i = 0; i < 60; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '微分中值定理与导数的应用',
      section: '洛必达法则',
      knowledge_points: ['kp-3-2-1'],
      title: '洛必达法则',
      content: `求极限 $\\lim_{x \\to 0} \\frac{e^{${a}x} - e^{-${b}x}}{\\sin x}$。`,
      answer: `$${a+b}$`,
      solution: `使用洛必达法则：$\\lim_{x \\to 0} \\frac{${a}e^{${a}x} + ${b}e^{-${b}x}}{\\cos x} = \\frac{${a}+${b}}{1} = ${a+b}$。`,
      hints: ['判断是否为 $\\frac{0}{0}$ 型', '使用洛必达法则'],
      tags: ['洛必达法则', '极限计算'],
      source: '经典题库',
      year: null,
    });
  }

  // 极值问题 - 多项式（原有 15 次，增加到 60 次）
  for (let i = 0; i < 60; i++) {
    const a = randInt(1, 3);
    const p = randInt(2, 5);
    const q = randInt(1, 5);
    const r = randInt(0, 5);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '微分中值定理与导数的应用',
      section: '函数的单调性与极值',
      knowledge_points: ['kp-3-3-1', 'kp-3-3-2'],
      title: '单调性与极值',
      content: `求函数 $f(x) = ${a}x^{${p}} - ${q}x^{${p-1}} + ${r}$ 的单调区间和极值。`,
      answer: `$f'(x) = ${a*p}x^{${p-1}} - ${q*(p-1)}x^{${p-2}}$，驻点 $x_1 = 0$ 和 $x_2 = \\frac{${q*(p-1)}}{${a*p}}$`,
      solution: `$f'(x) = ${a*p}x^{${p-1}} - ${q*(p-1)}x^{${p-2}} = x^{${p-2}}(${a*p}x - ${q*(p-1)})$。\n驻点：$x = 0$ 和 $x = \\frac{${q*(p-1)}}{${a*p}}$。\n根据 $f'(x)$ 的符号变化判断单调区间和极值。`,
      hints: ['求导数', '找驻点', '判断导数的符号变化'],
      tags: ['单调性', '极值'],
      source: '基础题库',
      year: null,
    });
  }

  // 新增：洛必达法则 ∞/∞ 型
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '微分中值定理与导数的应用',
      section: '洛必达法则',
      knowledge_points: ['kp-3-2-1'],
      title: '洛必达法则-无穷比无穷',
      content: `求极限 $\\lim_{x \\to +\\infty} \\frac{\\ln x}{x^{${a}}}$。`,
      answer: `$0$`,
      solution: `$\\frac{\\infty}{\\infty}$ 型，使用洛必达法则：$\\lim_{x \\to +\\infty} \\frac{\\frac{1}{x}}{${a}x^{${a-1}}} = \\lim_{x \\to +\\infty} \\frac{1}{${a}x^{${a}}} = 0$。`,
      hints: ['判断是否为 $\\frac{\\infty}{\\infty}$ 型', '使用洛必达法则'],
      tags: ['洛必达法则', '无穷比无穷'],
      source: '经典题库',
      year: null,
    });
  }

  // 新增：三次多项式极值
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 5);
    const c = randInt(1, 5);
    const d = randInt(0, 5);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '微分中值定理与导数的应用',
      section: '函数的单调性与极值',
      knowledge_points: ['kp-3-3-1', 'kp-3-3-2'],
      title: '三次函数极值',
      content: `求函数 $f(x) = ${a}x^3 - ${b}x^2 + ${c}x + ${d}$ 的极值点和极值。`,
      answer: `$f'(x) = ${3*a}x^2 - ${2*b}x + ${c}$，解 $f'(x)=0$ 得极值点`,
      solution: `$f'(x) = ${3*a}x^2 - ${2*b}x + ${c}$。令 $f'(x)=0$，解得 $x = \\frac{${2*b} \\pm \\sqrt{${4*b*b - 12*a*c}}}{${6*a}}$。根据 $f''(x)$ 的符号判断极大值与极小值。$f''(x) = ${6*a}x - ${2*b}$。`,
      hints: ['求导数 f\'(x)', '解 f\'(x)=0 找驻点', '用 f\'\'(x) 判断极值类型'],
      tags: ['极值', '三次函数'],
      source: '基础题库',
      year: null,
    });
  }

  // 新增：拐点与凹凸性
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 5);
    const c = randInt(1, 5);
    const d = randInt(0, 5);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '微分中值定理与导数的应用',
      section: '函数的凹凸性与拐点',
      knowledge_points: ['kp-3-3-3'],
      title: '拐点与凹凸性',
      content: `求函数 $f(x) = ${a}x^3 - ${b}x^2 + ${c}x + ${d}$ 的凹凸区间和拐点。`,
      answer: `$f''(x) = ${6*a}x - ${2*b}$，拐点 $x = \\frac{${b}}{${3*a}}$`,
      solution: `$f'(x) = ${3*a}x^2 - ${2*b}x + ${c}$，$f''(x) = ${6*a}x - ${2*b}$。令 $f''(x)=0$，得 $x = \\frac{${b}}{${3*a}}$。当 $x < \\frac{${b}}{${3*a}}$ 时 $f''(x) < 0$（上凸）；当 $x > \\frac{${b}}{${3*a}}$ 时 $f''(x) > 0$（下凸）。拐点为 $(\\frac{${b}}{${3*a}}, f(\\frac{${b}}{${3*a}}))$。`,
      hints: ['求二阶导数 f\'\'(x)', '解 f\'\'(x)=0 找拐点', '判断 f\'\'(x) 的符号'],
      tags: ['拐点', '凹凸性'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：渐近线
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '微分中值定理与导数的应用',
      section: '函数图形的描绘',
      knowledge_points: ['kp-3-3-4'],
      title: '渐近线',
      content: `求函数 $f(x) = \\frac{${a}x^2 + ${b}}{x}$ 的渐近线。`,
      answer: `铅直渐近线 $x=0$，斜渐近线 $y=${a}x$`,
      solution: `$\\lim_{x \\to 0} f(x) = \\infty$，故 $x=0$ 为铅直渐近线。$k = \\lim_{x \\to \\infty} \\frac{f(x)}{x} = \\lim_{x \\to \\infty} \\frac{${a}x^2 + ${b}}{x^2} = ${a}$，$b = \\lim_{x \\to \\infty} (f(x) - kx) = \\lim_{x \\to \\infty} \\frac{${b}}{x} = 0$，故 $y=${a}x$ 为斜渐近线。`,
      hints: ['垂直渐近线：分母为零的点', '斜渐近线：$y=kx+b$，$k=\\lim_{x\\to\\infty}\\frac{f(x)}{x}$'],
      tags: ['渐近线', '函数图像'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：泰勒公式
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch3-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '微分中值定理与导数的应用',
      section: '泰勒公式',
      knowledge_points: ['kp-3-1-3'],
      title: '泰勒公式',
      content: `求 $f(x) = e^{${a}x}$ 在 $x=0$ 处的三阶泰勒展开式。`,
      answer: `$f(x) \\approx 1 + ${a}x + \\frac{${a*a}}{2}x^2 + \\frac{${a*a*a}}{6}x^3$`,
      solution: `$f(0)=1$，$f'(0)=${a}$，$f''(0)=${a*a}$，$f'''(0)=${a*a*a}$。泰勒公式：$f(x) = f(0) + f'(0)x + \\frac{f''(0)}{2!}x^2 + \\frac{f'''(0)}{3!}x^3 + o(x^3) = 1 + ${a}x + \\frac{${a*a}}{2}x^2 + \\frac{${a*a*a}}{6}x^3 + o(x^3)$。`,
      hints: ['计算各阶导数在 $x=0$ 处的值', '代入泰勒公式'],
      tags: ['泰勒公式', '展开'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第四章：不定积分 ==========

function genCh4(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  const integralPatterns = [
    {
      content: (a: number, n: number) => `求不定积分 $\\int ${a}x^{${n}} dx$`,
      answer: (a: number, n: number) => `$\\frac{${a}}{${n+1}}x^{${n+1}} + C$`,
      solution: (a: number, n: number) => `$\\int ${a}x^{${n}} dx = \\frac{${a}}{${n+1}}x^{${n+1}} + C$`,
      diff: 1,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int ${a}^x dx$`,
      answer: (a: number) => a === 1 ? `$x + C$` : `$\\frac{${a}^x}{\\ln ${a}} + C$`,
      solution: (a: number) => a === 1 ? `$\\int 1^x dx = \\int 1 dx = x + C$` : `$\\int ${a}^x dx = \\frac{${a}^x}{\\ln ${a}} + C$`,
      diff: 2,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\sin ${a}x dx$`,
      answer: (a: number) => `$-\\frac{1}{${a}}\\cos ${a}x + C$`,
      solution: (a: number) => `$\\int \\sin ${a}x dx = -\\frac{1}{${a}}\\cos ${a}x + C$`,
      diff: 1,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\cos ${a}x dx$`,
      answer: (a: number) => `$\\frac{1}{${a}}\\sin ${a}x + C$`,
      solution: (a: number) => `$\\int \\cos ${a}x dx = \\frac{1}{${a}}\\sin ${a}x + C$`,
      diff: 1,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\frac{1}{${a}x} dx$`,
      answer: (a: number) => `$\\frac{1}{${a}}\\ln|x| + C$`,
      solution: (a: number) => `$\\int \\frac{1}{${a}x} dx = \\frac{1}{${a}}\\ln|x| + C$`,
      diff: 1,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\sec^2 ${a}x dx$`,
      answer: (a: number) => `$\\frac{1}{${a}}\\tan ${a}x + C$`,
      solution: (a: number) => `$\\int \\sec^2 ${a}x dx = \\frac{1}{${a}}\\tan ${a}x + C$`,
      diff: 2,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\frac{1}{\\sqrt{${a}^2 - x^2}} dx$`,
      answer: (a: number) => `$\\arcsin\\frac{x}{${a}} + C$`,
      solution: (a: number) => `$\\int \\frac{1}{\\sqrt{${a}^2 - x^2}} dx = \\arcsin\\frac{x}{${a}} + C$`,
      diff: 2,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\frac{1}{${a}^2 + x^2} dx$`,
      answer: (a: number) => `$\\frac{1}{${a}}\\arctan\\frac{x}{${a}} + C$`,
      solution: (a: number) => `$\\int \\frac{1}{${a}^2 + x^2} dx = \\frac{1}{${a}}\\arctan\\frac{x}{${a}} + C$`,
      diff: 2,
      kp: ['kp-4-1-1'],
    },
    {
      content: (a: number, n: number) => `求不定积分 $\\int x^{${a}}e^{${n}x} dx$`,
      answer: (a: number, n: number) => `需分部积分，递推求解`,
      solution: (a: number, n: number) => `使用分部积分法：设 $u = x^{${a}}, dv = e^{${n}x}dx$，则 $\\int x^{${a}}e^{${n}x} dx = \\frac{1}{${n}}x^{${a}}e^{${n}x} - \\frac{${a}}{${n}}\\int x^{${a-1}}e^{${n}x} dx$，递推求解。`,
      diff: 3,
      kp: ['kp-4-3-1'],
    },
    {
      content: (a: number, n: number) => `求不定积分 $\\int x^{${a}}\\ln ${n}x dx$`,
      answer: (a: number, n: number) => `$\\frac{x^{${a+1}}}{${a+1}}\\ln ${n}x - \\frac{x^{${a+1}}}{(${a+1})^2} + C$`,
      solution: (a: number, n: number) => `分部积分：设 $u = \\ln ${n}x, dv = x^{${a}}dx$，$\\int x^{${a}}\\ln ${n}x dx = \\frac{x^{${a+1}}}{${a+1}}\\ln ${n}x - \\frac{1}{${a+1}}\\int x^{${a}}dx = \\frac{x^{${a+1}}}{${a+1}}\\ln ${n}x - \\frac{x^{${a+1}}}{(${a+1})^2} + C$`,
      diff: 3,
      kp: ['kp-4-3-1'],
    },
  ];

  for (const pat of integralPatterns) {
    for (let i = 0; i < 50; i++) {
      const a = randInt(1, 5);
      const n = randInt(2, 5);
      id++;
      qs.push({
        id: `math-ch4-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '不定积分',
        section: '不定积分的计算',
        knowledge_points: pat.kp,
        title: '不定积分',
        content: pat.content(a, n),
        answer: pat.answer(a, n),
        solution: pat.solution(a, n),
        hints: ['使用基本积分公式', '考虑凑微分法或分部积分法'],
        tags: ['不定积分', '积分方法'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 新增积分模式
  const integralPatterns2 = [
    {
      content: (a: number, b: number) => `求不定积分 $\\int \\sin ${a}x \\cos ${b}x dx$`,
      answer: (a: number, b: number) => `$-\\frac{1}{2}[\\frac{\\cos(${a+b})x}{${a+b}} + \\frac{\\cos(${a-b})x}{${a-b}}] + C$`,
      solution: (a: number, b: number) => `积化和差：$\\sin ${a}x \\cos ${b}x = \\frac{1}{2}[\\sin(${a+b})x + \\sin(${a-b})x]$。$\\int \\sin ${a}x \\cos ${b}x dx = \\frac{1}{2}[\\int \\sin(${a+b})x dx + \\int \\sin(${a-b})x dx] = -\\frac{1}{2}[\\frac{\\cos(${a+b})x}{${a+b}} + \\frac{\\cos(${a-b})x}{${a-b}}] + C$。`,
      diff: 3,
      kp: ['kp-4-2-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\frac{x}{x^2 + ${a}^2} dx$`,
      answer: (a: number) => `$\\frac{1}{2}\\ln(x^2 + ${a}^2) + C$`,
      solution: (a: number) => `凑微分：$\\int \\frac{x}{x^2 + ${a}^2} dx = \\frac{1}{2}\\int \\frac{d(x^2 + ${a}^2)}{x^2 + ${a}^2} = \\frac{1}{2}\\ln(x^2 + ${a}^2) + C$。`,
      diff: 2,
      kp: ['kp-4-2-1'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\frac{1}{x^2 - ${a}^2} dx$`,
      answer: (a: number) => `$\\frac{1}{${2*a}}\\ln\\left|\\frac{x-${a}}{x+${a}}\\right| + C$`,
      solution: (a: number) => `$\\frac{1}{x^2-${a}^2} = \\frac{1}{${2*a}}(\\frac{1}{x-${a}} - \\frac{1}{x+${a}})$。$\\int \\frac{1}{x^2-${a}^2} dx = \\frac{1}{${2*a}}(\\ln|x-${a}| - \\ln|x+${a}|) + C = \\frac{1}{${2*a}}\\ln\\left|\\frac{x-${a}}{x+${a}}\\right| + C$。`,
      diff: 3,
      kp: ['kp-4-2-2'],
    },
    {
      content: (a: number) => `求不定积分 $\\int \\tan ${a}x dx$`,
      answer: (a: number) => `$-\\frac{1}{${a}}\\ln|\\cos ${a}x| + C$`,
      solution: (a: number) => `$\\int \\tan ${a}x dx = \\int \\frac{\\sin ${a}x}{\\cos ${a}x} dx = -\\frac{1}{${a}}\\int \\frac{d(\\cos ${a}x)}{\\cos ${a}x} = -\\frac{1}{${a}}\\ln|\\cos ${a}x| + C$。`,
      diff: 2,
      kp: ['kp-4-2-1'],
    },
    {
      content: (a: number, b: number) => `求不定积分 $\\int e^{${a}x}\\sin ${b}x dx$`,
      answer: (a: number, b: number) => `$\\frac{e^{${a}x}}{${a*a + b*b}}(${a}\\sin ${b}x - ${b}\\cos ${b}x) + C$`,
      solution: (a: number, b: number) => `分部积分（两次）或使用公式：$\\int e^{${a}x}\\sin ${b}x dx = \\frac{e^{${a}x}}{${a}^2 + ${b}^2}(${a}\\sin ${b}x - ${b}\\cos ${b}x) + C$。`,
      diff: 3,
      kp: ['kp-4-3-1'],
    },
  ];

  for (const pat of integralPatterns2) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 5);
      const b = randInt(1, 5);
      id++;
      qs.push({
        id: `math-ch4-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '不定积分',
        section: '不定积分的计算',
        knowledge_points: pat.kp,
        title: '不定积分',
        content: pat.content(a, b),
        answer: pat.answer(a, b),
        solution: pat.solution(a, b),
        hints: ['使用基本积分公式', '考虑凑微分法或分部积分法'],
        tags: ['不定积分', '积分方法'],
        source: '进阶题库',
        year: null,
      });
    }
  }

  return qs;
}

// ========== 第五章：定积分 ==========

function genCh5(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  for (let i = 0; i < 100; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const n = randInt(2, 4);
    id++;
    qs.push({
      id: `math-ch5-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '定积分',
      section: '定积分的计算',
      knowledge_points: ['kp-5-1-1', 'kp-5-2-1'],
      title: '定积分计算',
      content: `计算定积分 $\\int_{${a}}^{${b}} ${n}x^{${n-1}} dx$。`,
      answer: `$${b**n - a**n}$`,
      solution: `$\\int_{${a}}^{${b}} ${n}x^{${n-1}} dx = [x^{${n}}]_{${a}}^{${b}} = ${b**n} - ${a**n} = ${b**n - a**n}$。`,
      hints: ['使用牛顿-莱布尼茨公式'],
      tags: ['定积分', '牛顿-莱布尼茨公式'],
      source: '基础题库',
      year: null,
    });
  }

  for (let i = 0; i < 80; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch5-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '定积分',
      section: '定积分的计算',
      knowledge_points: ['kp-5-3-1'],
      title: '分部积分定积分',
      content: `计算定积分 $\\int_{${a}}^{${b}} x e^{${a}x} dx$。`,
      answer: `使用分部积分`,
      solution: `分部积分：$\\int_{${a}}^{${b}} x e^{${a}x} dx = [\\frac{x}{${a}}e^{${a}x}]_{${a}}^{${b}} - \\frac{1}{${a}}\\int_{${a}}^{${b}} e^{${a}x} dx = [\\frac{x}{${a}}e^{${a}x} - \\frac{1}{${a}^2}e^{${a}x}]_{${a}}^{${b}}$`,
      hints: ['使用分部积分法'],
      tags: ['定积分', '分部积分'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：定积分换元法
  for (let i = 0; i < 50; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch5-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '定积分',
      section: '定积分的计算',
      knowledge_points: ['kp-5-2-2'],
      title: '定积分换元法',
      content: `计算定积分 $\\int_{0}^{${a}} \\frac{x}{\\sqrt{x^2+${b}^2}} dx$。`,
      answer: `$\\sqrt{${a}^2+${b}^2} - ${b}$`,
      solution: `换元：令 $u = x^2 + ${b}^2$，则 $du = 2x dx$。$\\int_{0}^{${a}} \\frac{x}{\\sqrt{x^2+${b}^2}} dx = \\frac{1}{2}\\int_{${b*b}}^{${a*a+b*b}} \\frac{du}{\\sqrt{u}} = [\\sqrt{u}]_{${b*b}}^{${a*a+b*b}} = \\sqrt{${a}^2+${b}^2} - ${b}$。`,
      hints: ['使用换元法 $u = x^2 + b^2$'],
      tags: ['定积分', '换元法'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：平面图形面积
  for (let i = 0; i < 50; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch5-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '定积分',
      section: '定积分的应用',
      knowledge_points: ['kp-5-5-1'],
      title: '平面图形面积',
      content: `求由曲线 $y = ${a}x^2$ 与直线 $y = ${b}x$ 所围图形的面积。`,
      answer: `$\\frac{${b}^3}{${6*a*a}}$`,
      solution: `交点：${a}x^2 = ${b}x$，得 $x=0$ 和 $x=\\frac{${b}}{${a}}$。面积 $S = \\int_0^{${b/a}}(${b}x - ${a}x^2) dx = [\\frac{${b}}{2}x^2 - \\frac{${a}}{3}x^3]_0^{${b/a}} = \\frac{${b*b*b}}{${2*a*a}} - \\frac{${a*b*b*b}}{${3*a*a*a}} = \\frac{${b}^3}{${6*a*a}}$。`,
      hints: ['求交点确定积分区间', '面积 = $\\int_a^b (上线 - 下线) dx$'],
      tags: ['定积分应用', '面积'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：旋转体体积
  for (let i = 0; i < 50; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch5-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '定积分',
      section: '定积分的应用',
      knowledge_points: ['kp-5-5-2'],
      title: '旋转体体积',
      content: `求由 $y = ${a}x$，$x = ${b}$ 及 $x$ 轴围成的三角形绕 $x$ 轴旋转所得旋转体的体积。`,
      answer: `$\\frac{${a*a*b*b*b}\\pi}{3}$`,
      solution: `$V = \\pi \\int_0^{${b}} (${a}x)^2 dx = \\pi \\cdot ${a}^2 \\int_0^{${b}} x^2 dx = \\pi \\cdot ${a}^2 \\cdot \\frac{${b}^3}{3} = \\frac{${a*a*b*b*b}\\pi}{3}$。`,
      hints: ['旋转体体积公式：$V = \\pi \\int_a^b [f(x)]^2 dx$'],
      tags: ['旋转体', '体积'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：反常积分
  for (let i = 0; i < 50; i++) {
    const a = randInt(1, 4);
    const p = randInt(2, 4);
    id++;
    qs.push({
      id: `math-ch5-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '定积分',
      section: '反常积分',
      knowledge_points: ['kp-5-6-1'],
      title: '反常积分',
      content: `计算反常积分 $\\int_{${a}}^{+\\infty} \\frac{1}{x^{${p}}} dx$。`,
      answer: `$\\frac{1}{(${p-1})${a}^{${p-1}}}$`,
      solution: `$\\int_{${a}}^{+\\infty} \\frac{1}{x^{${p}}} dx = \\lim_{b \\to +\\infty} \\int_{${a}}^{b} x^{-${p}} dx = \\lim_{b \\to +\\infty} [-\\frac{1}{${p-1}}x^{-${p-1}}]_{${a}}^{b} = \\frac{1}{${p-1}} \\cdot \\frac{1}{${a}^{${p-1}}}$。`,
      hints: ['反常积分 = 极限形式的定积分', '先求定积分再取极限'],
      tags: ['反常积分', '无穷区间'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第六章：多元函数微分学 ==========

function genCh6(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  const partialPatterns = [
    {
      content: (a: number, b: number, m: number, n: number) => `求 $f(x,y) = ${a}x^{${m}}y^{${n}}$ 的偏导数 $\\frac{\\partial f}{\\partial x}$ 和 $\\frac{\\partial f}{\\partial y}$`,
      answer: (a: number, b: number, m: number, n: number) => `$\\frac{\\partial f}{\\partial x} = ${a*m}x^{${m-1}}y^{${n}}$，$\\frac{\\partial f}{\\partial y} = ${a*n}x^{${m}}y^{${n-1}}$`,
      solution: (a: number, b: number, m: number, n: number) => `$\\frac{\\partial f}{\\partial x} = ${a} \\cdot ${m} x^{${m-1}} y^{${n}} = ${a*m}x^{${m-1}}y^{${n}}$（$y$ 视为常数）\n$\\frac{\\partial f}{\\partial y} = ${a} \\cdot ${n} x^{${m}} y^{${n-1}} = ${a*n}x^{${m}}y^{${n-1}}$（$x$ 视为常数）`,
      diff: 1,
      kp: ['kp-5-1-1'],
    },
    {
      content: (a: number, b: number) => `求 $f(x,y) = ${a}\\sin x \\cos ${b}y$ 的偏导数`,
      answer: (a: number, b: number) => `$\\frac{\\partial f}{\\partial x} = ${a}\\cos x \\cos ${b}y$，$\\frac{\\partial f}{\\partial y} = -${a*b}\\sin x \\sin ${b}y$`,
      solution: (a: number, b: number) => `$\\frac{\\partial f}{\\partial x} = ${a}\\cos x \\cos ${b}y$，$\\frac{\\partial f}{\\partial y} = ${a}\\sin x \\cdot (-${b}\\sin ${b}y) = -${a*b}\\sin x \\sin ${b}y$`,
      diff: 2,
      kp: ['kp-5-1-1'],
    },
    {
      content: (a: number, b: number) => `求 $f(x,y) = e^{${a}x + ${b}y}$ 的二阶偏导数 $\\frac{\\partial^2 f}{\\partial x \\partial y}$`,
      answer: (a: number, b: number) => `$${a*b}e^{${a}x + ${b}y}$`,
      solution: (a: number, b: number) => `$\\frac{\\partial f}{\\partial x} = ${a}e^{${a}x + ${b}y}$，$\\frac{\\partial^2 f}{\\partial x \\partial y} = ${a} \\cdot ${b} e^{${a}x + ${b}y} = ${a*b}e^{${a}x + ${b}y}$`,
      diff: 2,
      kp: ['kp-5-1-2'],
    },
  ];

  for (const pat of partialPatterns) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 4);
      const b = randInt(1, 4);
      const m = randInt(2, 4);
      const n = randInt(2, 4);
      id++;
      qs.push({
        id: `math-ch6-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '多元函数微分学',
        section: '偏导数与全微分',
        knowledge_points: pat.kp,
        title: '偏导数计算',
        content: pat.content(a, b, m, n),
        answer: pat.answer(a, b, m, n),
        solution: pat.solution(a, b, m, n),
        hints: ['求偏导时将其他变量视为常数'],
        tags: ['偏导数', '全微分'],
        source: '基础题库',
        year: null,
      });
    }
  }

  // 新增：复合函数求偏导（链式法则）
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch6-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '多元函数微分学',
      section: '多元复合函数求导',
      knowledge_points: ['kp-5-2-1'],
      title: '复合函数求偏导',
      content: `设 $z = e^{${a}u + ${b}v}$，$u = x^2$，$v = xy$，求 $\\frac{\\partial z}{\\partial x}$。`,
      answer: `$\\frac{\\partial z}{\\partial x} = e^{${a}x^2 + ${b}xy}(${2*a}x + ${b}y)$`,
      solution: `链式法则：$\\frac{\\partial z}{\\partial x} = \\frac{\\partial z}{\\partial u}\\frac{\\partial u}{\\partial x} + \\frac{\\partial z}{\\partial v}\\frac{\\partial v}{\\partial x} = ${a}e^{${a}u+${b}v} \\cdot 2x + ${b}e^{${a}u+${b}v} \\cdot y = e^{${a}x^2+${b}xy}(${2*a}x + ${b}y)$。`,
      hints: ['使用链式法则', '画树形图分析变量关系'],
      tags: ['链式法则', '复合函数'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：隐函数求偏导
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    const c = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch6-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '多元函数微分学',
      section: '隐函数求导',
      knowledge_points: ['kp-5-2-3'],
      title: '隐函数求偏导',
      content: `设 $z = z(x,y)$ 由 $x^{${a}} + y^{${b}} + z^{${c}} = 1$ 确定，求 $\\frac{\\partial z}{\\partial x}$。`,
      answer: `$\\frac{\\partial z}{\\partial x} = -\\frac{${a}x^{${a-1}}}{${c}z^{${c-1}}}$`,
      solution: `两边对 $x$ 求偏导：$${a}x^{${a-1}} + ${c}z^{${c-1}} \\cdot \\frac{\\partial z}{\\partial x} = 0$，解得 $\\frac{\\partial z}{\\partial x} = -\\frac{${a}x^{${a-1}}}{${c}z^{${c-1}}}$。`,
      hints: ['两边对 $x$ 求偏导', '注意 $z$ 是 $x,y$ 的函数'],
      tags: ['隐函数', '偏导数'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：方向导数
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch6-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '多元函数微分学',
      section: '方向导数与梯度',
      knowledge_points: ['kp-5-3-1'],
      title: '方向导数',
      content: `求 $f(x,y) = ${a}x^2 + ${b}y^2$ 在点 $(1, 1)$ 处沿方向 $\\vec{l} = (1, 1)$ 的方向导数。`,
      answer: `$${2*a + 2*b}/\\sqrt{2}$`,
      solution: `$\\nabla f = (${2*a}x, ${2*b}y)$。在 $(1,1)$ 处 $\\nabla f(1,1) = (${2*a}, ${2*b})$。单位方向向量 $\\vec{e} = (\\frac{1}{\\sqrt{2}}, \\frac{1}{\\sqrt{2}})$。方向导数 $\\frac{\\partial f}{\\partial \\vec{l}} = \\nabla f \\cdot \\vec{e} = \\frac{${2*a}}{\\sqrt{2}} + \\frac{${2*b}}{\\sqrt{2}} = \\frac{${2*a+2*b}}{\\sqrt{2}}$。`,
      hints: ['计算梯度 $\\nabla f$', '方向导数 = 梯度与单位方向向量的点积'],
      tags: ['方向导数', '梯度'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：全微分
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch6-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '多元函数微分学',
      section: '全微分',
      knowledge_points: ['kp-5-1-3'],
      title: '全微分',
      content: `求 $z = ${a}x^2y + ${b}xy^2$ 在点 $(1, 1)$ 处的全微分 $dz$。`,
      answer: `$dz|_{(1,1)} = (${2*a+b})dx + (${a+2*b})dy$`,
      solution: `$\\frac{\\partial z}{\\partial x} = ${2*a}xy + ${b}y^2$，$\\frac{\\partial z}{\\partial y} = ${a}x^2 + ${2*b}xy$。在 $(1,1)$：$\\frac{\\partial z}{\\partial x}|_{(1,1)} = ${2*a+b}$，$\\frac{\\partial z}{\\partial y}|_{(1,1)} = ${a+2*b}$。$dz = (${2*a+b})dx + (${a+2*b})dy$。`,
      hints: ['求偏导数', '全微分 $dz = \\frac{\\partial z}{\\partial x}dx + \\frac{\\partial z}{\\partial y}dy$'],
      tags: ['全微分'],
      source: '基础题库',
      year: null,
    });
  }

  // 新增：切平面方程
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    const c = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch6-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '多元函数微分学',
      section: '几何应用',
      knowledge_points: ['kp-5-4-1'],
      title: '切平面方程',
      content: `求曲面 $z = ${a}x^2 + ${b}y^2$ 在点 $(1, 1, ${a+b})$ 处的切平面方程。`,
      answer: `$${2*a}(x-1) + ${2*b}(y-1) - (z-${a+b}) = 0$`,
      solution: `$F(x,y,z) = ${a}x^2 + ${b}y^2 - z = 0$。$\\nabla F = (${2*a}x, ${2*b}y, -1)$。在 $(1,1,${a+b})$ 处 $\\nabla F = (${2*a}, ${2*b}, -1)$。切平面：${2*a}(x-1) + ${2*b}(y-1) - (z-${a+b}) = 0$。`,
      hints: ['求梯度 $\\nabla F$', '切平面方程：$F_x(x_0)(x-x_0) + F_y(y_0)(y-y_0) + F_z(z_0)(z-z_0) = 0$'],
      tags: ['切平面', '梯度'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第七章：多元函数积分学 ==========

function genCh7(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  for (let i = 0; i < 60; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch7-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '多元函数积分学',
      section: '二重积分',
      knowledge_points: ['kp-6-1-1', 'kp-6-1-3'],
      title: '二重积分',
      content: `计算二重积分 $\\iint_D ${a}x dxdy$，其中 $D: 0 \\leq x \\leq ${b}, 0 \\leq y \\leq ${c}$。`,
      answer: `$${a*b*c*b/2}$`,
      solution: `$\\iint_D ${a}x dxdy = ${a}\\int_0^{${b}} x dx \\int_0^{${c}} dy = ${a} \\cdot \\frac{${b}^2}{2} \\cdot ${c} = ${a*b*c*b/2}$`,
      hints: ['确定积分区域', '先对 $y$ 积分再对 $x$ 积分'],
      tags: ['二重积分'],
      source: '进阶题库',
      year: null,
    });
  }

  for (let i = 0; i < 50; i++) {
    const R = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch7-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '多元函数积分学',
      section: '二重积分',
      knowledge_points: ['kp-6-1-4'],
      title: '极坐标二重积分',
      content: `使用极坐标计算二重积分 $\\iint_D e^{-(x^2+y^2)} dxdy$，其中 $D: x^2+y^2 \\leq ${R}^2$。`,
      answer: `$\\pi(1 - e^{-${R*R}})$`,
      solution: `极坐标：$\\iint_D e^{-(x^2+y^2)} dxdy = \\int_0^{2\\pi} d\\theta \\int_0^{${R}} e^{-r^2} \\cdot r dr = 2\\pi \\cdot [-\\frac{1}{2}e^{-r^2}]_0^{${R}} = \\pi(1 - e^{-${R*R}})$`,
      hints: ['使用极坐标变换 $x = r\\cos\\theta, y = r\\sin\\theta$'],
      tags: ['二重积分', '极坐标'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：三角形区域二重积分
  for (let i = 0; i < 45; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch7-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '多元函数积分学',
      section: '二重积分',
      knowledge_points: ['kp-6-1-2'],
      title: '三角形区域二重积分',
      content: `计算二重积分 $\\iint_D ${a}xy dxdy$，其中 $D$ 由 $x=0, y=0, x+y=${b}$ 围成。`,
      answer: `$${a} \\cdot \\frac{${b}^4}{24}$`,
      solution: `积分顺序：$x$ 从 0 到 ${b}$，$y$ 从 0 到 ${b}-x$。\n$\\iint_D ${a}xy dxdy = ${a}\\int_0^{${b}} x dx \\int_0^{${b}-x} y dy = ${a}\\int_0^{${b}} x \\cdot \\frac{(${b}-x)^2}{2} dx = ${a} \\cdot \\frac{${b}^4}{24}$。`,
      hints: ['确定积分限', '累次积分'],
      tags: ['二重积分', '累次积分'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：三重积分（直角坐标）
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch7-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '多元函数积分学',
      section: '三重积分',
      knowledge_points: ['kp-6-2-1'],
      title: '长方体三重积分',
      content: `计算三重积分 $\\iiint_{\\Omega} ${a}xyz dV$，其中 $\\Omega: 0 \\leq x \\leq ${b}, 0 \\leq y \\leq ${c}, 0 \\leq z \\leq 1$。`,
      answer: `$${a} \\cdot \\frac{${b}^2}{2} \\cdot \\frac{${c}^2}{2} \\cdot \\frac{1}{2} = \\frac{${a*b*b*c*c}}{8}$`,
      solution: `$\\iiint_{\\Omega} ${a}xyz dV = ${a}\\int_0^{${b}} x dx \\int_0^{${c}} y dy \\int_0^1 z dz = ${a} \\cdot \\frac{${b}^2}{2} \\cdot \\frac{${c}^2}{2} \\cdot \\frac{1}{2} = \\frac{${a*b*b*c*c}}{8}$。`,
      hints: ['三重积分化为累次积分', '依次积分'],
      tags: ['三重积分', '直角坐标'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：第一类曲线积分
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch7-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '多元函数积分学',
      section: '曲线积分',
      knowledge_points: ['kp-6-3-1'],
      title: '第一类曲线积分',
      content: `计算曲线积分 $\\int_L ${a}x ds$，其中 $L$ 是圆周 $x^2+y^2 = ${b}^2$。`,
      answer: `$0$`,
      solution: `参数化：$x = ${b}\\cos t, y = ${b}\\sin t$，$t \\in [0, 2\\pi]$。$ds = ${b} dt$。$\\int_L ${a}x ds = \\int_0^{2\\pi} ${a}(${b}\\cos t) \\cdot ${b} dt = ${a*b*b} \\int_0^{2\\pi} \\cos t dt = 0$。`,
      hints: ['参数化曲线', '第一类曲线积分公式'],
      tags: ['曲线积分', '第一类'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第八章：无穷级数 ==========

function genCh8(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  const seriesPatterns = [
    {
      content: (a: number, p: number) => `判断级数 $\\sum_{n=1}^{\\infty} \\frac{${a}}{n^{${p}}}$ 的收敛性`,
      answer: (a: number, p: number) => p > 1 ? '收敛' : '发散',
      solution: (a: number, p: number) => `$p$ 级数 $\\sum \\frac{${a}}{n^{${p}}}$，当 $p=${p} ${p > 1 ? '> 1' : '\\leq 1'}$ 时${p > 1 ? '收敛' : '发散'}。`,
      diff: 1,
      kp: ['kp-7-1-1'],
    },
    {
      content: (a: number) => `求幂级数 $\\sum_{n=1}^{\\infty} \\frac{x^n}{${a}^n}$ 的收敛半径`,
      answer: (a: number) => `$${a}$`,
      solution: (a: number) => `$R = \\lim_{n \\to \\infty} |\\frac{a_n}{a_{n+1}}| = \\lim_{n \\to \\infty} \\frac{1/${a}^n}{1/${a}^{n+1}} = ${a}$`,
      diff: 2,
      kp: ['kp-7-2-2'],
    },
    {
      content: (a: number) => `求幂级数 $\\sum_{n=1}^{\\infty} \\frac{x^n}{${a}n}$ 的收敛半径和收敛区间`,
      answer: (a: number) => `收敛半径 $R=1$，收敛区间 $[-1, 1)$`,
      solution: (a: number) => `$R = \\lim_{n \\to \\infty} \\frac{1/(${a}n)}{1/(${a}(n+1))} = 1$。$x=1$ 时 $\\sum \\frac{1}{${a}n}$ 发散；$x=-1$ 时 $\\sum \\frac{(-1)^n}{${a}n}$ 收敛。故收敛区间为 $[-1, 1)$`,
      diff: 3,
      kp: ['kp-7-2-2', 'kp-7-2-5'],
    },
  ];

  for (const pat of seriesPatterns) {
    for (let i = 0; i < 40; i++) {
      const a = randInt(1, 5);
      const p = randInt(1, 4);
      id++;
      qs.push({
        id: `math-ch8-${String(id).padStart(4, '0')}`,
        type: 'calculation',
        difficulty: pat.diff,
        chapter: '无穷级数',
        section: '常数项级数与幂级数',
        knowledge_points: pat.kp,
        title: '级数',
        content: pat.content(a, p),
        answer: pat.answer(a, p),
        solution: pat.solution(a, p),
        hints: ['使用各种审敛法', '注意收敛半径的计算'],
        tags: ['级数', '收敛性', '幂级数'],
        source: '经典题库',
        year: null,
      });
    }
  }

  // 新增：比值判别法
  for (let i = 0; i < 45; i++) {
    const a = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch8-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '无穷级数',
      section: '常数项级数',
      knowledge_points: ['kp-7-1-3'],
      title: '比值判别法',
      content: `用比值判别法判断级数 $\\sum_{n=1}^{\\infty} \\frac{${a}^n}{n!}$ 的收敛性。`,
      answer: '收敛',
      solution: `$\\lim_{n \\to \\infty} \\frac{u_{n+1}}{u_n} = \\lim_{n \\to \\infty} \\frac{${a}^{n+1}/(n+1)!}{${a}^n/n!} = \\lim_{n \\to \\infty} \\frac{${a}}{n+1} = 0 < 1$，故级数收敛。`,
      hints: ['使用比值判别法 $\\lim_{n\\to\\infty} \\frac{u_{n+1}}{u_n} = \\rho$'],
      tags: ['级数', '比值判别法', '收敛性'],
      source: '经典题库',
      year: null,
    });
  }

  // 新增：交错级数莱布尼茨判别法
  for (let i = 0; i < 45; i++) {
    const a = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch8-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '无穷级数',
      section: '常数项级数',
      knowledge_points: ['kp-7-1-4'],
      title: '莱布尼茨判别法',
      content: `判断交错级数 $\\sum_{n=1}^{\\infty} (-1)^{n-1} \\frac{1}{n^{${a}}$ 的收敛性。`,
      answer: '${a} > 0$ 时条件收敛',
      solution: `${a} > 0$ 时 $u_n = \\frac{1}{n^{${a}}}$ 满足：(1) $u_n \\geq u_{n+1}$，(2) $\\lim_{n\\to\\infty} u_n = 0$。由莱布尼茨判别法，交错级数收敛。而 $\\sum |u_n| = \\sum \\frac{1}{n^{${a}}$，当 ${a} > 1$ 时绝对收敛，当 $0 < ${a} \\leq 1$ 时条件收敛。`,
      hints: ['验证莱布尼茨条件：单调递减、极限为零'],
      tags: ['交错级数', '莱布尼茨判别法'],
      source: '经典题库',
      year: null,
    });
  }

  // 新增：幂级数求和
  for (let i = 0; i < 40; i++) {
    id++;
    qs.push({
      id: `math-ch8-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '无穷级数',
      section: '幂级数',
      knowledge_points: ['kp-7-2-6'],
      title: '幂级数求和',
      content: `求幂级数 $\\sum_{n=1}^{\\infty} \\frac{x^n}{n}$ 的和函数（$|x| < 1$）。`,
      answer: `$s(x) = -\\ln(1-x)$，$x \\in (-1, 1)$`,
      solution: `逐项求导：$s'(x) = \\sum_{n=1}^{\\infty} x^{n-1} = \\frac{1}{1-x}$。积分得 $s(x) = s(0) + \\int_0^x \\frac{1}{1-t} dt = -\\ln(1-x)$。`,
      hints: ['逐项求导或逐项积分', '利用等比级数求和公式'],
      tags: ['幂级数', '求和'],
      source: '进阶题库',
      year: null,
    });
  }

  // 新增：傅里叶级数系数
  for (let i = 0; i < 35; i++) {
    id++;
    qs.push({
      id: `math-ch8-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '无穷级数',
      section: '傅里叶级数',
      knowledge_points: ['kp-7-3-1'],
      title: '傅里叶系数计算',
      content: `求 $f(x) = x$ 在 $(-\\pi, \\pi)$ 上的傅里叶系数 $a_0$。`,
      answer: `$a_0 = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} x dx = 0$`,
      solution: `$a_0 = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} f(x) dx = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} x dx = 0$。由于 $f(x) = x$ 是奇函数，积分区间对称，故 $a_0 = 0$。`,
      hints: ['傅里叶系数公式 $a_n = \\frac{1}{\\pi}\\int_{-\\pi}^{\\pi} f(x)\\cos nx dx$'],
      tags: ['傅里叶级数', '傅里叶系数'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 第九章：常微分方程 (新增) ==========

function genCh9(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  // 可分离变量微分方程
  for (let i = 0; i < 60; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    id++;
    qs.push({
      id: `math-ch9-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '常微分方程',
      section: '一阶微分方程',
      knowledge_points: ['kp-8-1-1'],
      title: '可分离变量方程',
      content: `求微分方程 $\\frac{dy}{dx} = ${a}x y$ 的通解。`,
      answer: `$y = C e^{\\frac{${a}}{2}x^2}$`,
      solution: `分离变量：$\\frac{dy}{y} = ${a}x dx$。两边积分：$\\ln|y| = \\frac{${a}}{2}x^2 + C_1$，故 $y = C e^{\\frac{${a}}{2}x^2}$（其中 $C = \\pm e^{C_1}$ 为任意常数）。`,
      hints: ['分离变量', '两边积分'],
      tags: ['可分离变量', '一阶微分方程'],
      source: '基础题库',
      year: null,
    });
  }

  // 一阶线性微分方程
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch9-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '常微分方程',
      section: '一阶微分方程',
      knowledge_points: ['kp-8-1-2'],
      title: '一阶线性微分方程',
      content: `求微分方程 $y' + ${a}y = ${b}$ 的通解。`,
      answer: `$y = \\frac{${b}}{${a}} + C e^{-${a}x}$`,
      solution: `一阶线性方程 $y' + P(x)y = Q(x)$，通解公式：$y = e^{-\\int P(x)dx}(\\int Q(x)e^{\\int P(x)dx}dx + C)$。\n这里 $P = ${a}, Q = ${b}$，故 $y = e^{-${a}x}(\\int ${b}e^{${a}x} dx + C) = e^{-${a}x}(\\frac{${b}}{${a}}e^{${a}x} + C) = \\frac{${b}}{${a}} + C e^{-${a}x}$。`,
      hints: ['使用通解公式', '或者用常数变易法'],
      tags: ['一阶线性', '常数变易法'],
      source: '基础题库',
      year: null,
    });
  }

  // 齐次方程
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch9-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '常微分方程',
      section: '一阶微分方程',
      knowledge_points: ['kp-8-1-3'],
      title: '齐次微分方程',
      content: `求微分方程 $\\frac{dy}{dx} = \\frac{y}{x} + ${a}\\sqrt{\\frac{y}{x}}$ 的通解。`,
      answer: `令 $u = \\frac{y}{x}$，分离变量积分求解得 $\\sqrt{\\frac{y}{x}} = \\frac{${a}}{2}\\ln x + C$`,
      solution: `令 $y = ux$，则 $\\frac{dy}{dx} = u + x\\frac{du}{dx}$。代入得：$u + x\\frac{du}{dx} = u + ${a}\\sqrt{u}$，即 $x\\frac{du}{dx} = ${a}\\sqrt{u}$。分离变量：$\\frac{du}{\\sqrt{u}} = \\frac{${a} dx}{x}$，积分得 $2\\sqrt{u} = ${a}\\ln x + 2C$，即 $\\sqrt{\\frac{y}{x}} = \\frac{${a}}{2}\\ln x + C$。`,
      hints: ['令 $y = ux$ 换元', '化为可分离变量方程'],
      tags: ['齐次方程', '换元法'],
      source: '进阶题库',
      year: null,
    });
  }

  // 二阶常系数齐次线性微分方程
  for (let i = 0; i < 40; i++) {
    const p = randInt(1, 4);
    const q = randInt(1, 4);
    id++;
    qs.push({
      id: `math-ch9-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '常微分方程',
      section: '高阶微分方程',
      knowledge_points: ['kp-8-2-1'],
      title: '二阶常系数齐次方程',
      content: `求微分方程 $y'' + ${p}y' + ${q}y = 0$ 的通解。`,
      answer: () => {
        const delta = p*p - 4*q;
        if (delta > 0) {
          const r1 = (-p + Math.sqrt(delta))/2;
          const r2 = (-p - Math.sqrt(delta))/2;
          return `$y = C_1 e^{${r1}x} + C_2 e^{${r2}x}$`;
        } else if (delta === 0) {
          const r = -p/2;
          return `$y = (C_1 + C_2 x)e^{${r}x}$`;
        } else {
          const alpha = -p/2;
          const beta = Math.sqrt(-delta)/2;
          return `$y = e^{${alpha}x}(C_1\\cos ${beta}x + C_2\\sin ${beta}x)$`;
        }
      },
      solution: () => {
        const delta = p*p - 4*q;
        if (delta > 0) {
          const r1 = (-p + Math.sqrt(delta))/2;
          const r2 = (-p - Math.sqrt(delta))/2;
          return `特征方程：$r^2 + ${p}r + ${q} = 0$，特征根 $r_1 = ${r1}, r_2 = ${r2}$（两个不同实根）。通解 $y = C_1 e^{${r1}x} + C_2 e^{${r2}x}$。`;
        } else if (delta === 0) {
          const r = -p/2;
          return `特征方程：$r^2 + ${p}r + ${q} = 0$，重根 $r = ${r}$。通解 $y = (C_1 + C_2 x)e^{${r}x}$。`;
        } else {
          const alpha = -p/2;
          const beta = Math.sqrt(-delta)/2;
          return `特征方程：$r^2 + ${p}r + ${q} = 0$，共轭复根 $r = ${alpha} \\pm i${beta}$。通解 $y = e^{${alpha}x}(C_1\\cos ${beta}x + C_2\\sin ${beta}x)$。`;
        }
      },
      hints: ['写出特征方程', '根据特征根类型写出通解'],
      tags: ['二阶常系数', '齐次线性'],
      source: '进阶题库',
      year: null,
    } as any);
  }

  // 二阶常系数非齐次线性微分方程
  for (let i = 0; i < 40; i++) {
    const p = randInt(1, 3);
    const a = randInt(1, 3);
    id++;
    qs.push({
      id: `math-ch9-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '常微分方程',
      section: '高阶微分方程',
      knowledge_points: ['kp-8-2-2'],
      title: '二阶常系数非齐次方程',
      content: `求微分方程 $y'' + ${p}y' = ${a}x$ 的通解。`,
      answer: `$y = C_1 + C_2 e^{-${p}x} + \\frac{${a}}{2${p}}x^2 - \\frac{${a}}{${p}^2}x$`,
      solution: `齐次方程 $y'' + ${p}y' = 0$，特征方程 $r^2 + ${p}r = 0$，特征根 $r_1 = 0, r_2 = -${p}$。齐次通解 $Y = C_1 + C_2 e^{-${p}x}$。\n由于 $\\lambda=0$ 是单根，设特解 $y^* = x(Ax+B) = Ax^2+Bx$。代入得 $2A + ${p}(2Ax+B) = ${a}x$，比较系数得 $A = \\frac{${a}}{2${p}}, B = -\\frac{${a}}{${p}^2}$。故通解 $y = Y + y^* = C_1 + C_2 e^{-${p}x} + \\frac{${a}}{2${p}}x^2 - \\frac{${a}}{${p}^2}x$。`,
      hints: ['先求齐次通解', '根据自由项设特解', '比较系数确定特解'],
      tags: ['二阶常系数', '非齐次', '待定系数'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 线性代数（扩展） ==========

function genLinearAlgebra(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  // 行列式计算（原有 15 次，增加到 60 次）
  for (let i = 0; i < 60; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const c = randInt(1, 5);
    const d = randInt(1, 5);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 1,
      chapter: '线性代数',
      section: '行列式',
      knowledge_points: ['kp-la-1-1'],
      title: '二阶行列式',
      content: `计算行列式 $\\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{vmatrix}$。`,
      answer: `$${a*d - b*c}$`,
      solution: `$\\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{vmatrix} = ${a} \\times ${d} - ${b} \\times ${c} = ${a*d - b*c}$。`,
      hints: ['使用二阶行列式公式'],
      tags: ['行列式'],
      source: '基础题库',
      year: null,
    });
  }

  // 三阶行列式
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 3);
    const d = randInt(1, 3);
    const e = randInt(1, 3);
    const f = randInt(1, 3);
    const g = randInt(1, 3);
    const h = randInt(1, 3);
    const k = randInt(1, 3);
    const det = a*e*k + b*f*g + c*d*h - c*e*g - b*d*k - a*f*h;
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '线性代数',
      section: '行列式',
      knowledge_points: ['kp-la-1-2'],
      title: '三阶行列式',
      content: `计算三阶行列式 $\\begin{vmatrix} ${a} & ${b} & ${c} \\\\ ${d} & ${e} & ${f} \\\\ ${g} & ${h} & ${k} \\end{vmatrix}$。`,
      answer: `$${det}$`,
      solution: `按对角线法则计算：$${a} \\times ${e} \\times ${k} + ${b} \\times ${f} \\times ${g} + ${c} \\times ${d} \\times ${h} - ${c} \\times ${e} \\times ${g} - ${b} \\times ${d} \\times ${k} - ${a} \\times ${f} \\times ${h} = ${det}$。`,
      hints: ['使用对角线法则'],
      tags: ['行列式', '三阶'],
      source: '基础题库',
      year: null,
    });
  }

  // 矩阵运算（原有 15 次，增加到 50 次）
  for (let i = 0; i < 50; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 3);
    const d = randInt(1, 3);
    const e = randInt(1, 3);
    const f = randInt(1, 3);
    const g = randInt(1, 3);
    const h = randInt(1, 3);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '线性代数',
      section: '矩阵运算',
      knowledge_points: ['kp-la-2-1'],
      title: '矩阵乘法',
      content: `设 $A = \\begin{pmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{pmatrix}$，$B = \\begin{pmatrix} ${e} & ${f} \\\\ ${g} & ${h} \\end{pmatrix}$，求 $AB$。`,
      answer: `$\\begin{pmatrix} ${a*e+b*g} & ${a*f+b*h} \\\\ ${c*e+d*g} & ${c*f+d*h} \\end{pmatrix}$`,
      solution: `$AB = \\begin{pmatrix} ${a} \\cdot ${e} + ${b} \\cdot ${g} & ${a} \\cdot ${f} + ${b} \\cdot ${h} \\\\ ${c} \\cdot ${e} + ${d} \\cdot ${g} & ${c} \\cdot ${f} + ${d} \\cdot ${h} \\end{pmatrix} = \\begin{pmatrix} ${a*e+b*g} & ${a*f+b*h} \\\\ ${c*e+d*g} & ${c*f+d*h} \\end{pmatrix}$`,
      hints: ['使用矩阵乘法规则'],
      tags: ['矩阵乘法'],
      source: '基础题库',
      year: null,
    });
  }

  // 逆矩阵（原有 10 次，增加到 40 次）
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 3);
    const d = randInt(1, 3);
    const det = a*d - b*c;
    if (det === 0) continue;
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '线性代数',
      section: '逆矩阵',
      knowledge_points: ['kp-la-2-3'],
      title: '逆矩阵',
      content: `求矩阵 $A = \\begin{pmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{pmatrix}$ 的逆矩阵。`,
      answer: `$A^{-1} = \\frac{1}{${det}}\\begin{pmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{pmatrix}$`,
      solution: `$|A| = ${a} \\times ${d} - ${b} \\times ${c} = ${det}$。$A^* = \\begin{pmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{pmatrix}$。$A^{-1} = \\frac{1}{${det}}A^* = \\frac{1}{${det}}\\begin{pmatrix} ${d} & ${-b} \\\\ ${-c} & ${a} \\end{pmatrix}$。`,
      hints: ['计算伴随矩阵', '除以行列式'],
      tags: ['逆矩阵', '伴随矩阵'],
      source: '基础题库',
      year: null,
    });
  }

  // 特征值（原有 10 次，增加到 35 次）
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '线性代数',
      section: '特征值与特征向量',
      knowledge_points: ['kp-la-5-1'],
      title: '特征值',
      content: `求矩阵 $A = \\begin{pmatrix} ${a} & ${b} \\\\ ${b} & ${a} \\end{pmatrix}$ 的特征值。`,
      answer: `$\\lambda_1 = ${a+b}$，$\\lambda_2 = ${a-b}$`,
      solution: `$|A - \\lambda I| = \\begin{vmatrix} ${a}-\\lambda & ${b} \\\\ ${b} & ${a}-\\lambda \\end{vmatrix} = (${a}-\\lambda)^2 - ${b}^2 = \\lambda^2 - ${2*a}\\lambda + ${a*a-b*b} = 0$\n解得 $\\lambda = ${a} \\pm ${b}$，即 $\\lambda_1 = ${a+b}$，$\\lambda_2 = ${a-b}$。`,
      hints: ['解特征方程 $|A - \\lambda I| = 0$'],
      tags: ['特征值'],
      source: '进阶题库',
      year: null,
    });
  }

  // 特征向量
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 3);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '线性代数',
      section: '特征值与特征向量',
      knowledge_points: ['kp-la-5-2'],
      title: '特征向量',
      content: `求矩阵 $A = \\begin{pmatrix} ${a} & 0 \\\\ 0 & ${a+1} \\end{pmatrix}$ 的特征向量。`,
      answer: `$\\lambda_1=${a}$ 对应的特征向量 $k_1(1,0)^T$；$\\lambda_2=${a+1}$ 对应的特征向量 $k_2(0,1)^T$（$k_1,k_2 \\neq 0$）`,
      solution: `$|A - \\lambda I| = \\begin{vmatrix} ${a}-\\lambda & 0 \\\\ 0 & ${a+1}-\\lambda \\end{vmatrix} = (${a}-\\lambda)(${a+1}-\\lambda) = 0$。\n$\\lambda_1 = ${a}$：解 $(A - ${a}I)x = 0$，得 $x_2 = 0$，特征向量 $k_1(1,0)^T$。\n$\\lambda_2 = ${a+1}$：解 $(A - (${a+1})I)x = 0$，得 $x_1 = 0$，特征向量 $k_2(0,1)^T$。`,
      hints: ['先求特征值', '代入 $(A - \\lambda I)x = 0$ 解特征向量'],
      tags: ['特征向量', '特征值'],
      source: '进阶题库',
      year: null,
    });
  }

  // 矩阵的秩
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '线性代数',
      section: '矩阵的秩',
      knowledge_points: ['kp-la-2-4'],
      title: '矩阵的秩',
      content: `求矩阵 $A = \\begin{pmatrix} 1 & ${a} & ${b} \\\\ 2 & ${2*a} & ${2*b} \\\\ 3 & ${3*a} & ${3*b} \\end{pmatrix}$ 的秩。`,
      answer: '$1$',
      solution: `第二行是第一行的 2 倍，第三行是第一行的 3 倍，故行向量线性相关，秩为 1。`,
      hints: ['进行初等行变换化为行阶梯形'],
      tags: ['矩阵的秩', '行阶梯形'],
      source: '基础题库',
      year: null,
    });
  }

  // 线性方程组求解
  for (let i = 0; i < 45; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    const c = randInt(1, 5);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '线性代数',
      section: '线性方程组',
      knowledge_points: ['kp-la-3-1'],
      title: '线性方程组求解',
      content: `解线性方程组 $\\begin{cases} x + y = ${c} \\\\ ${a}x - ${b}y = 1 \\end{cases}$。`,
      answer: `$x = \\frac{${b*c+1}}{${a+b}}$，$y = \\frac{${a*c-1}}{${a+b}}$`,
      solution: `由第一个方程 $y = ${c} - x$，代入第二个：${a}x - ${b}(${c} - x) = 1$，即 $(${a}+${b})x = ${b*c} + 1$，得 $x = \\frac{${b*c+1}}{${a+b}}$。$y = ${c} - x = \\frac{${a*c-1}}{${a+b}}$。`,
      hints: ['用代入法或消元法', '或用矩阵求逆'],
      tags: ['线性方程组', '消元法'],
      source: '进阶题库',
      year: null,
    });
  }

  // 矩阵对角化
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 3);
    const b = randInt(1, 3);
    id++;
    qs.push({
      id: `math-la-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '线性代数',
      section: '矩阵对角化',
      knowledge_points: ['kp-la-5-3'],
      title: '矩阵对角化',
      content: `判断矩阵 $A = \\begin{pmatrix} ${a} & ${b} \\\\ 0 & ${a} \\end{pmatrix}$ 是否可对角化。`,
      answer: `${b === 0 ? '可对角化（已是对角矩阵）' : '不可对角化（几何重数小于代数重数）'}`,
      solution: `特征值 $\\lambda = ${a}$（二重根）。${b !== 0 ? `解 $(A - ${a}I)x = 0$，得 $\\begin{pmatrix} 0 & ${b} \\\\ 0 & 0 \\end{pmatrix}x = 0$，即 ${b}x_2 = 0$，$x_2 = 0$，特征向量 $k(1,0)^T$，几何重数为 1 < 代数重数 2，故不可对角化。` : `已是对角矩阵，显然可对角化。`}`,
      hints: ['求特征值', '判断几何重数是否等于代数重数'],
      tags: ['对角化', '特征值'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// ========== 概率论与数理统计（扩展） ==========

function genProbability(): Question[] {
  const qs: Question[] = [];
  let id = 0;

  // 概率计算（原有 15 次，增加到 60 次）
  for (let i = 0; i < 60; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const c = randInt(1, 5);
    const total = a + b + c;
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 1,
      chapter: '概率论',
      section: '概率的基本概念',
      knowledge_points: ['kp-prob-1-1'],
      title: '古典概型',
      content: `袋中有 ${a} 个红球，${b} 个蓝球，${c} 个白球，随机取一球，求取到红球的概率。`,
      answer: `$${formatFrac(a, total)}$`,
      solution: `总球数 $N = ${a} + ${b} + ${c} = ${total}$，红球数 $= ${a}$，故 $P = \\frac{${a}}{${total}}$。`,
      hints: ['使用古典概型 $P = \\frac{\\text{有利结果数}}{\\text{总结果数}}$'],
      tags: ['概率', '古典概型'],
      source: '基础题库',
      year: null,
    });
  }

  // 条件概率
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const c = randInt(1, 5);
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '概率论',
      section: '条件概率',
      knowledge_points: ['kp-prob-1-3'],
      title: '条件概率',
      content: `已知 $P(A) = ${formatFrac(a, a+b)}$，$P(B) = ${formatFrac(b, a+b)}$，$P(AB) = ${formatFrac(c, a+b+c)}$，求 $P(A|B)$。`,
      answer: `$P(A|B) = ${formatFrac(c, b*(a+b+c)/(a+b))}$`,
      solution: `$P(A|B) = \\frac{P(AB)}{P(B)} = \\frac{${formatFrac(c, a+b+c)}}{${formatFrac(b, a+b)}} = \\frac{${c}}{${a+b+c}} \\cdot \\frac{${a+b}}{${b}} = \\frac{${c*(a+b)}}{${b*(a+b+c)}}$`,
      hints: ['使用条件概率公式 $P(A|B) = \\frac{P(AB)}{P(B)}$'],
      tags: ['条件概率', '贝叶斯'],
      source: '进阶题库',
      year: null,
    });
  }

  // 期望值（原有 15 次，增加到 50 次）
  for (let i = 0; i < 50; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const n = a + b;
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '概率论',
      section: '随机变量的数字特征',
      knowledge_points: ['kp-prob-2-2'],
      title: '数学期望',
      content: `设随机变量 $X$ 的分布列为：$P(X=${a}) = ${formatFrac(a, n)}$，$P(X=${b}) = ${formatFrac(b, n)}$，求 $E(X)$。`,
      answer: `$${formatFrac(a*a + b*b, n)}$`,
      solution: `$E(X) = ${a} \\cdot \\frac{${a}}{${n}} + ${b} \\cdot \\frac{${b}}{${n}} = \\frac{${a*a} + ${b*b}}{${n}} = ${formatFrac(a*a + b*b, n)}$。`,
      hints: ['使用期望公式 $E(X) = \\sum x_i p_i$'],
      tags: ['期望', '分布列'],
      source: '基础题库',
      year: null,
    });
  }

  // 方差
  for (let i = 0; i < 40; i++) {
    const a = randInt(1, 5);
    const b = randInt(1, 5);
    const n = a + b;
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 2,
      chapter: '概率论',
      section: '随机变量的数字特征',
      knowledge_points: ['kp-prob-2-3'],
      title: '方差',
      content: `设随机变量 $X$ 的分布列为：$P(X=${a}) = ${formatFrac(a, n)}$，$P(X=${b}) = ${formatFrac(b, n)}$，求 $D(X)$。`,
      answer: `$D(X) = ${formatFrac(a*b*(a-b)*(a-b), n*n)}$`,
      solution: `$E(X) = \\frac{${a*a + b*b}}{${n}}$。$E(X^2) = ${a*a} \\cdot \\frac{${a}}{${n}} + ${b*b} \\cdot \\frac{${b}}{${n}} = \\frac{${a*a*a + b*b*b}}{${n}}$。$D(X) = E(X^2) - [E(X)]^2 = \\frac{${a*a*a + b*b*b}}{${n}} - \\frac{(${a*a + b*b})^2}{${n*n}} = \\frac{${a*b*(a-b)*(a-b)}}{${n*n}}$。`,
      hints: ['使用方差公式 $D(X) = E(X^2) - [E(X)]^2$'],
      tags: ['方差', '数字特征'],
      source: '进阶题库',
      year: null,
    });
  }

  // 二项分布
  for (let i = 0; i < 35; i++) {
    const n = randInt(2, 5);
    const p = randInt(1, 9) / 10;
    const k = randInt(0, n);
    const comb = factorial(n) / (factorial(k) * factorial(n - k));
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '概率论',
      section: '常见分布',
      knowledge_points: ['kp-prob-2-1'],
      title: '二项分布',
      content: `设 $X \\sim B(${n}, ${p})$，求 $P(X = ${k})$。`,
      answer: `$C_{${n}}^{${k}} \\cdot ${p}^{${k}} \\cdot ${(1-p)}^{${n-k}}$`,
      solution: `$P(X = ${k}) = C_{${n}}^{${k}} p^{${k}} (1-p)^{${n-k}} = ${comb} \\cdot ${p}^{${k}} \\cdot ${(1-p)}^{${n-k}}$`,
      hints: ['使用二项分布概率公式'],
      tags: ['二项分布', '概率分布'],
      source: '进阶题库',
      year: null,
    });
  }

  // 全概率公式
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    const c = randInt(1, 4);
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '概率论',
      section: '全概率公式与贝叶斯公式',
      knowledge_points: ['kp-prob-1-4'],
      title: '全概率公式',
      content: `某产品由甲、乙两厂生产。甲厂产量占 ${formatFrac(a, a+b)}$，次品率 ${formatFrac(1, c+5)}$；乙厂产量占 ${formatFrac(b, a+b)}$，次品率 ${formatFrac(1, c+3)}$。求任取一件产品为次品的概率。`,
      answer: `$P = \\frac{${a}}{${a+b}} \\cdot \\frac{1}{${c+5}} + \\frac{${b}}{${a+b}} \\cdot \\frac{1}{${c+3}}$`,
      solution: `设 $A$ = 甲厂，$B$ = 乙厂，$C$ = 次品。$P(C) = P(A)P(C|A) + P(B)P(C|B) = \\frac{${a}}{${a+b}} \\cdot \\frac{1}{${c+5}} + \\frac{${b}}{${a+b}} \\cdot \\frac{1}{${c+3}}$。`,
      hints: ['使用全概率公式', '划分样本空间'],
      tags: ['全概率公式', '贝叶斯'],
      source: '进阶题库',
      year: null,
    });
  }

  // 正态分布概率
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 3);
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 3,
      chapter: '概率论',
      section: '正态分布',
      knowledge_points: ['kp-prob-2-4'],
      title: '正态分布概率',
      content: `设 $X \\sim N(0, 1)$，求 $P(|X| < ${a})$。`,
      answer: `$2\\Phi(${a}) - 1 \\approx ${(2 * normCdf(a) - 1).toFixed(4)}$`,
      solution: `$P(|X| < ${a}) = P(-${a} < X < ${a}) = \\Phi(${a}) - \\Phi(-${a}) = \\Phi(${a}) - (1 - \\Phi(${a})) = 2\\Phi(${a}) - 1$。`,
      hints: ['利用标准正态分布的对称性', '查标准正态分布表'],
      tags: ['正态分布', '概率'],
      source: '进阶题库',
      year: null,
    });
  }

  // 协方差与相关系数
  for (let i = 0; i < 35; i++) {
    const a = randInt(1, 4);
    const b = randInt(1, 4);
    id++;
    qs.push({
      id: `math-prob-${String(id).padStart(4, '0')}`,
      type: 'calculation',
      difficulty: 4,
      chapter: '概率论',
      section: '随机变量的数字特征',
      knowledge_points: ['kp-prob-2-5'],
      title: '协方差',
      content: `已知 $D(X) = ${a}$，$D(Y) = ${b}$，$D(X+Y) = ${a+b+2}$，求 $\\text{Cov}(X, Y)$。`,
      answer: `$\\text{Cov}(X, Y) = 1$`,
      solution: `$D(X+Y) = D(X) + D(Y) + 2\\text{Cov}(X, Y)$。代入：${a+b+2} = ${a} + ${b} + 2\\text{Cov}(X, Y)$，得 $\\text{Cov}(X, Y) = 1$。`,
      hints: ['使用方差展开公式 $D(X+Y) = D(X) + D(Y) + 2\\text{Cov}(X,Y)$'],
      tags: ['协方差', '相关性'],
      source: '进阶题库',
      year: null,
    });
  }

  return qs;
}

// 辅助函数：阶乘
function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// 辅助函数：标准正态分布 CDF 近似
function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// ========== 主函数 ==========

function main() {
  const allQuestions = [
    ...genCh1(),
    ...genCh2(),
    ...genCh3(),
    ...genCh4(),
    ...genCh5(),
    ...genCh6(),
    ...genCh7(),
    ...genCh8(),
    ...genCh9(),
    ...genLinearAlgebra(),
    ...genProbability(),
  ];

  const outputPath = path.join(__dirname, '..', 'data', 'questions', 'math-full.json');
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(allQuestions, null, 2), 'utf-8');

  console.log(`生成完成！共 ${allQuestions.length} 道题目`);
  console.log(`输出文件：${outputPath}`);
  console.log(`文件大小：${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);

  // 按章节统计
  const chapterCounts: Record<string, number> = {};
  for (const q of allQuestions) {
    chapterCounts[q.chapter] = (chapterCounts[q.chapter] || 0) + 1;
  }
  console.log('\n各章节题目数量：');
  for (const [ch, count] of Object.entries(chapterCounts)) {
    console.log(`  ${ch}: ${count} 题`);
  }
}

main();
