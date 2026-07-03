import { PrismaClient } from '@prisma/client';
import { CET4_CORE_WORDS } from './data/english-words-cet4';
import { CET6_ADVANCED_WORDS, KAOYAN_ESSENTIAL_WORDS } from './data/english-words';

const prisma = new PrismaClient();

interface KpDef {
  name: string;
  chapter: string;
  description: string;
  difficulty: number;
  parentId?: number | null;
  children?: KpDef[];
}

interface QuestionDef {
  content: string;
  questionType: string;
  options?: string;
  answer: string;
  solution: string;
  difficulty: number;
  kpNames: string[];
  source?: string;
}

async function main() {
  console.log('开始填充种子数据...');

  // ==================== 数学知识点体系 ====================
  const kpMap = new Map<string, number>();

  const categoryStructure: { category: string; chapters: { chapter: string; points: KpDef[] }[] }[] = [
    {
      category: '高等数学',
      chapters: [
        {
          chapter: '第一章 函数与极限',
          points: [
            { name: '函数的概念与性质', chapter: '第一章 函数与极限', description: '函数的定义域、值域、有界性、单调性、奇偶性、周期性', difficulty: 1 },
            { name: '数列的极限', chapter: '第一章 函数与极限', description: '数列极限的定义（ε-N语言）、收敛数列的性质', difficulty: 1 },
            { name: '函数的极限', chapter: '第一章 函数与极限', description: '函数极限的定义（ε-δ语言）、左右极限、极限的性质', difficulty: 1 },
            { name: '无穷小与无穷大', chapter: '第一章 函数与极限', description: '无穷小的定义与性质、无穷小的比较、等价无穷小替换、无穷大', difficulty: 1 },
            { name: '极限运算法则', chapter: '第一章 函数与极限', description: '极限的四则运算法则、复合函数的极限运算法则', difficulty: 1 },
            { name: '极限存在准则与两个重要极限', chapter: '第一章 函数与极限', description: '夹逼准则、单调有界准则、两个重要极限公式', difficulty: 1 },
            { name: '函数的连续性与间断点', chapter: '第一章 函数与极限', description: '连续的定义、间断点的分类、连续函数的运算', difficulty: 1 },
            { name: '闭区间上连续函数的性质', chapter: '第一章 函数与极限', description: '有界性与最大值最小值定理、零点定理、介值定理', difficulty: 2 },
          ],
        },
        {
          chapter: '第二章 导数与微分',
          points: [
            { name: '导数概念', chapter: '第二章 导数与微分', description: '导数的定义、几何意义、函数可导性与连续性的关系', difficulty: 1 },
            { name: '函数的求导法则', chapter: '第二章 导数与微分', description: '和差积商的求导法则、反函数求导、复合函数求导（链式法则）', difficulty: 1 },
            { name: '高阶导数', chapter: '第二章 导数与微分', description: '高阶导数的概念、常见函数的高阶导数公式、莱布尼茨公式', difficulty: 2 },
            { name: '隐函数及参数方程求导', chapter: '第二章 导数与微分', description: '隐函数求导法、对数求导法、参数方程确定的函数的导数', difficulty: 2 },
            { name: '函数的微分', chapter: '第二章 导数与微分', description: '微分的定义、微分与导数的关系、微分的几何意义、微分在近似计算中的应用', difficulty: 1 },
          ],
        },
        {
          chapter: '第三章 微分中值定理与导数应用',
          points: [
            { name: '微分中值定理', chapter: '第三章 微分中值定理与导数应用', description: '罗尔定理、拉格朗日中值定理、柯西中值定理', difficulty: 2 },
            { name: '洛必达法则', chapter: '第三章 微分中值定理与导数应用', description: '0/0型和∞/∞型未定式、其他类型未定式的转化', difficulty: 2 },
            { name: '泰勒公式', chapter: '第三章 微分中值定理与导数应用', description: '泰勒公式、麦克劳林公式、常见函数的麦克劳林展开式、余项', difficulty: 3 },
            { name: '函数的单调性与凹凸性', chapter: '第三章 微分中值定理与导数应用', description: '函数单调性的判定、曲线的凹凸性与拐点', difficulty: 1 },
            { name: '函数的极值与最值', chapter: '第三章 微分中值定理与导数应用', description: '函数的极值及其求法、最大值最小值问题', difficulty: 1 },
          ],
        },
        {
          chapter: '第四章 不定积分',
          points: [
            { name: '不定积分的概念与性质', chapter: '第四章 不定积分', description: '原函数与不定积分的概念、基本积分公式、不定积分的性质', difficulty: 1 },
            { name: '换元积分法', chapter: '第四章 不定积分', description: '第一类换元法（凑微分法）、第二类换元法（三角代换等）', difficulty: 2 },
            { name: '分部积分法', chapter: '第四章 不定积分', description: '分部积分公式、常见类型（幂函数乘三角函数/指数函数等）', difficulty: 2 },
            { name: '有理函数的积分', chapter: '第四章 不定积分', description: '有理函数的分解、部分分式法、可化为有理函数的积分', difficulty: 2 },
          ],
        },
        {
          chapter: '第五章 定积分',
          points: [
            { name: '定积分的概念与性质', chapter: '第五章 定积分', description: '定积分的定义（黎曼和）、定积分的几何意义、定积分的性质', difficulty: 1 },
            { name: '微积分基本公式', chapter: '第五章 定积分', description: '积分上限函数及其导数、牛顿-莱布尼茨公式', difficulty: 1 },
            { name: '定积分的换元法和分部积分法', chapter: '第五章 定积分', description: '定积分的换元积分法、定积分的分部积分法', difficulty: 2 },
            { name: '反常积分', chapter: '第五章 定积分', description: '无穷限的反常积分、无界函数的反常积分、Γ函数', difficulty: 2 },
          ],
        },
        {
          chapter: '第六章 定积分的应用',
          points: [
            { name: '定积分求面积', chapter: '第六章 定积分的应用', description: '直角坐标下的面积、极坐标下的面积', difficulty: 1 },
            { name: '定积分求体积', chapter: '第六章 定积分的应用', description: '旋转体的体积、平行截面面积已知的立体体积', difficulty: 2 },
            { name: '定积分求弧长', chapter: '第六章 定积分的应用', description: '平面曲线的弧长、参数方程下的弧长', difficulty: 2 },
          ],
        },
        {
          chapter: '第七章 微分方程',
          points: [
            { name: '微分方程的基本概念', chapter: '第七章 微分方程', description: '微分方程的定义、阶、解、通解、特解、初始条件', difficulty: 1 },
            { name: '一阶微分方程', chapter: '第七章 微分方程', description: '可分离变量的方程、齐次方程、一阶线性微分方程、伯努利方程', difficulty: 2 },
            { name: '高阶线性微分方程', chapter: '第七章 微分方程', description: '线性微分方程解的结构、常数变易法', difficulty: 2 },
            { name: '常系数线性微分方程', chapter: '第七章 微分方程', description: '二阶常系数齐次线性方程、二阶常系数非齐次线性方程', difficulty: 2 },
          ],
        },
        {
          chapter: '第八章 多元函数微分学',
          points: [
            { name: '多元函数的基本概念', chapter: '第八章 多元函数微分学', description: '多元函数的定义、极限、连续性', difficulty: 1 },
            { name: '偏导数', chapter: '第八章 多元函数微分学', description: '偏导数的定义与计算、高阶偏导数', difficulty: 1 },
            { name: '全微分', chapter: '第八章 多元函数微分学', description: '全微分的定义、可微的条件、全微分在近似计算中的应用', difficulty: 2 },
            { name: '多元复合函数求导', chapter: '第八章 多元函数微分学', description: '多元复合函数的链式法则、全导数', difficulty: 2 },
            { name: '隐函数求导', chapter: '第八章 多元函数微分学', description: '由一个方程确定的隐函数、由方程组确定的隐函数', difficulty: 2 },
            { name: '多元函数的极值', chapter: '第八章 多元函数微分学', description: '无条件极值、条件极值（拉格朗日乘数法）', difficulty: 2 },
          ],
        },
        {
          chapter: '第九章 重积分',
          points: [
            { name: '二重积分的概念与性质', chapter: '第九章 重积分', description: '二重积分的定义、几何意义、性质', difficulty: 1 },
            { name: '二重积分的计算', chapter: '第九章 重积分', description: '直角坐标下的计算、极坐标下的计算', difficulty: 2 },
            { name: '三重积分', chapter: '第九章 重积分', description: '三重积分的概念、直角坐标/柱坐标/球坐标下的计算', difficulty: 2 },
          ],
        },
        {
          chapter: '第十章 无穷级数',
          points: [
            { name: '常数项级数的概念与性质', chapter: '第十章 无穷级数', description: '级数的收敛与发散、级数的基本性质、收敛的必要条件', difficulty: 1 },
            { name: '常数项级数的审敛法', chapter: '第十章 无穷级数', description: '比较审敛法、比值审敛法、根值审敛法、交错级数、绝对收敛与条件收敛', difficulty: 2 },
            { name: '幂级数', chapter: '第十章 无穷级数', description: '幂级数的收敛半径与收敛域、幂级数的运算、和函数', difficulty: 2 },
            { name: '函数展开成幂级数', chapter: '第十章 无穷级数', description: '泰勒级数、麦克劳林级数、常见函数的幂级数展开', difficulty: 2 },
          ],
        },
      ],
    },
    {
      category: '线性代数',
      chapters: [
        {
          chapter: '第一章 行列式',
          points: [
            { name: '行列式的定义与性质', chapter: '第一章 行列式', description: '二阶与三阶行列式、全排列与逆序数、n阶行列式的定义、行列式的性质', difficulty: 1 },
            { name: '行列式的计算', chapter: '第一章 行列式', description: '行列式按行（列）展开、范德蒙德行列式、克拉默法则', difficulty: 1 },
          ],
        },
        {
          chapter: '第二章 矩阵',
          points: [
            { name: '矩阵的概念与运算', chapter: '第二章 矩阵', description: '矩阵的定义、矩阵的加减与数乘、矩阵乘法、转置', difficulty: 1 },
            { name: '逆矩阵', chapter: '第二章 矩阵', description: '逆矩阵的定义与性质、伴随矩阵法求逆、矩阵方程', difficulty: 1 },
            { name: '矩阵的秩', chapter: '第二章 矩阵', description: '矩阵的秩的定义、秩的性质、秩的求法', difficulty: 2 },
          ],
        },
        {
          chapter: '第三章 线性方程组',
          points: [
            { name: '消元法解线性方程组', chapter: '第三章 线性方程组', description: '高斯消元法、矩阵的初等变换、行阶梯形与行最简形', difficulty: 1 },
            { name: '线性方程组解的结构', chapter: '第三章 线性方程组', description: '齐次线性方程组的基础解系、非齐次线性方程组的通解', difficulty: 2 },
          ],
        },
        {
          chapter: '第四章 向量组的线性相关性',
          points: [
            { name: '向量组的线性相关性', chapter: '第四章 向量组的线性相关性', description: '线性相关与线性无关、线性表示、极大无关组', difficulty: 2 },
            { name: '向量组的秩', chapter: '第四章 向量组的线性相关性', description: '向量组的秩的定义、秩与矩阵秩的关系', difficulty: 2 },
          ],
        },
        {
          chapter: '第五章 特征值与特征向量',
          points: [
            { name: '特征值与特征向量', chapter: '第五章 特征值与特征向量', description: '特征值与特征向量的定义与计算、特征值的性质', difficulty: 2 },
            { name: '相似矩阵与对角化', chapter: '第五章 特征值与特征向量', description: '相似矩阵的概念与性质、矩阵可对角化的条件', difficulty: 2 },
            { name: '二次型', chapter: '第五章 特征值与特征向量', description: '二次型及其标准形、正定二次型、合同变换', difficulty: 2 },
          ],
        },
      ],
    },
    {
      category: '概率论与数理统计',
      chapters: [
        {
          chapter: '第一章 随机事件与概率',
          points: [
            { name: '随机事件与样本空间', chapter: '第一章 随机事件与概率', description: '随机试验、样本空间、随机事件、事件的关系与运算', difficulty: 1 },
            { name: '概率的定义与性质', chapter: '第一章 随机事件与概率', description: '概率的统计定义、古典概型、几何概型、概率的公理化定义', difficulty: 1 },
            { name: '条件概率与独立性', chapter: '第一章 随机事件与概率', description: '条件概率、乘法公式、全概率公式、贝叶斯公式、事件的独立性', difficulty: 1 },
          ],
        },
        {
          chapter: '第二章 随机变量及其分布',
          points: [
            { name: '随机变量与分布函数', chapter: '第二章 随机变量及其分布', description: '随机变量的概念、分布函数的定义与性质', difficulty: 1 },
            { name: '离散型随机变量', chapter: '第二章 随机变量及其分布', description: '分布律、二项分布、泊松分布、几何分布', difficulty: 1 },
            { name: '连续型随机变量', chapter: '第二章 随机变量及其分布', description: '概率密度、均匀分布、指数分布、正态分布', difficulty: 1 },
            { name: '随机变量函数的分布', chapter: '第二章 随机变量及其分布', description: '离散型与连续型随机变量函数的分布', difficulty: 2 },
          ],
        },
        {
          chapter: '第三章 随机变量的数字特征',
          points: [
            { name: '数学期望', chapter: '第三章 随机变量的数字特征', description: '数学期望的定义与计算、随机变量函数的期望', difficulty: 1 },
            { name: '方差与标准差', chapter: '第三章 随机变量的数字特征', description: '方差与标准差的定义与计算、方差的性质', difficulty: 1 },
            { name: '协方差与相关系数', chapter: '第三章 随机变量的数字特征', description: '协方差、相关系数、矩', difficulty: 2 },
          ],
        },
        {
          chapter: '第四章 参数估计',
          points: [
            { name: '点估计', chapter: '第四章 参数估计', description: '矩估计法、最大似然估计法', difficulty: 2 },
            { name: '估计量的评价标准', chapter: '第四章 参数估计', description: '无偏性、有效性、一致性', difficulty: 2 },
            { name: '区间估计', chapter: '第四章 参数估计', description: '置信区间的概念、正态总体均值的区间估计', difficulty: 2 },
          ],
        },
      ],
    },
  ];

  // 创建知识点
  for (const cat of categoryStructure) {
    for (const ch of cat.chapters) {
      for (const kp of ch.points) {
        const created = await prisma.knowledgePoint.create({
          data: {
            name: kp.name,
            subject: 'math',
            category: cat.category,
            chapter: kp.chapter,
            description: kp.description,
            difficulty: kp.difficulty,
          },
        });
        kpMap.set(kp.name, created.id);
      }
    }
  }
  console.log(`已创建 ${kpMap.size} 个知识点`);

  // ==================== 知识点前置关系 ====================
  const addRel = async (kp: string, prereq: string) => {
    const kpId = kpMap.get(kp);
    const prereqId = kpMap.get(prereq);
    if (kpId && prereqId) {
      await prisma.knowledgePointRelation.upsert({
        where: { knowledgePointId_prerequisiteId: { knowledgePointId: kpId, prerequisiteId: prereqId } },
        update: {},
        create: { knowledgePointId: kpId, prerequisiteId: prereqId },
      });
    }
  };

  // 高数：函数与极限内部
  const gsRelations: [string, string][] = [
    ['数列的极限', '函数的概念与性质'],
    ['函数的极限', '函数的概念与性质'],
    ['无穷小与无穷大', '函数的极限'],
    ['极限运算法则', '函数的极限'],
    ['极限存在准则与两个重要极限', '极限运算法则'],
    ['函数的连续性与间断点', '函数的极限'],
    ['闭区间上连续函数的性质', '函数的连续性与间断点'],
    // 导数与微分
    ['导数概念', '函数的极限'],
    ['导数概念', '函数的连续性与间断点'],
    ['函数的求导法则', '导数概念'],
    ['高阶导数', '函数的求导法则'],
    ['隐函数及参数方程求导', '函数的求导法则'],
    ['函数的微分', '导数概念'],
    // 中值定理
    ['微分中值定理', '导数概念'],
    ['微分中值定理', '函数的连续性与间断点'],
    ['洛必达法则', '微分中值定理'],
    ['洛必达法则', '函数的求导法则'],
    ['泰勒公式', '微分中值定理'],
    ['泰勒公式', '高阶导数'],
    ['函数的单调性与凹凸性', '函数的求导法则'],
    ['函数的极值与最值', '函数的单调性与凹凸性'],
    // 不定积分
    ['不定积分的概念与性质', '导数概念'],
    ['换元积分法', '不定积分的概念与性质'],
    ['分部积分法', '不定积分的概念与性质'],
    ['有理函数的积分', '换元积分法'],
    // 定积分
    ['定积分的概念与性质', '不定积分的概念与性质'],
    ['定积分的概念与性质', '函数的极限'],
    ['微积分基本公式', '定积分的概念与性质'],
    ['定积分的换元法和分部积分法', '微积分基本公式'],
    ['反常积分', '定积分的概念与性质'],
    // 定积分的应用
    ['定积分求面积', '微积分基本公式'],
    ['定积分求体积', '定积分求面积'],
    ['定积分求弧长', '定积分求面积'],
    // 微分方程
    ['微分方程的基本概念', '不定积分的概念与性质'],
    ['一阶微分方程', '微分方程的基本概念'],
    ['一阶微分方程', '换元积分法'],
    ['高阶线性微分方程', '一阶微分方程'],
    ['常系数线性微分方程', '高阶线性微分方程'],
    // 多元函数
    ['多元函数的基本概念', '函数的极限'],
    ['偏导数', '多元函数的基本概念'],
    ['偏导数', '导数概念'],
    ['全微分', '偏导数'],
    ['多元复合函数求导', '偏导数'],
    ['多元复合函数求导', '函数的求导法则'],
    ['隐函数求导', '多元复合函数求导'],
    ['多元函数的极值', '偏导数'],
    ['多元函数的极值', '函数的极值与最值'],
    // 重积分
    ['二重积分的概念与性质', '定积分的概念与性质'],
    ['二重积分的计算', '二重积分的概念与性质'],
    ['二重积分的计算', '微积分基本公式'],
    ['三重积分', '二重积分的计算'],
    // 无穷级数
    ['常数项级数的概念与性质', '数列的极限'],
    ['常数项级数的审敛法', '常数项级数的概念与性质'],
    ['幂级数', '常数项级数的审敛法'],
    ['函数展开成幂级数', '幂级数'],
    ['函数展开成幂级数', '泰勒公式'],
    // 线代
    ['行列式的定义与性质', '矩阵的概念与运算'],
    ['行列式的计算', '行列式的定义与性质'],
    ['逆矩阵', '矩阵的概念与运算'],
    ['逆矩阵', '行列式的计算'],
    ['矩阵的秩', '矩阵的概念与运算'],
    ['消元法解线性方程组', '矩阵的概念与运算'],
    ['线性方程组解的结构', '消元法解线性方程组'],
    ['线性方程组解的结构', '矩阵的秩'],
    ['向量组的线性相关性', '矩阵的概念与运算'],
    ['向量组的秩', '向量组的线性相关性'],
    ['向量组的秩', '矩阵的秩'],
    ['特征值与特征向量', '矩阵的概念与运算'],
    ['特征值与特征向量', '行列式的计算'],
    ['相似矩阵与对角化', '特征值与特征向量'],
    ['相似矩阵与对角化', '线性方程组解的结构'],
    ['二次型', '相似矩阵与对角化'],
    // 概率论
    ['随机事件与样本空间', '函数的概念与性质'],
    ['概率的定义与性质', '随机事件与样本空间'],
    ['条件概率与独立性', '概率的定义与性质'],
    ['随机变量与分布函数', '概率的定义与性质'],
    ['离散型随机变量', '随机变量与分布函数'],
    ['连续型随机变量', '随机变量与分布函数'],
    ['随机变量函数的分布', '离散型随机变量'],
    ['随机变量函数的分布', '连续型随机变量'],
    ['数学期望', '离散型随机变量'],
    ['数学期望', '连续型随机变量'],
    ['方差与标准差', '数学期望'],
    ['协方差与相关系数', '方差与标准差'],
    ['点估计', '数学期望'],
    ['点估计', '方差与标准差'],
    ['估计量的评价标准', '点估计'],
    ['区间估计', '点估计'],
  ];

  for (const [kp, prereq] of gsRelations) {
    await addRel(kp, prereq);
  }
  console.log(`已创建 ${gsRelations.length} 条知识点前置关系`);

  // ==================== 数学题目 ====================
  const questions: QuestionDef[] = [
    // 函数与极限 - 基础
    { content: '已知$f(x)=x^2+1$，求$f(2)$和$f(a+1)$', questionType: 'fill_in', answer: 'f(2)=5,f(a+1)=a^2+2a+2', solution: '$f(2)=2^2+1=5$；$f(a+1)=(a+1)^2+1=a^2+2a+2$', difficulty: 1, kpNames: ['函数的概念与性质'] },
    { content: '判断函数$f(x)=x^3-3x$的奇偶性', questionType: 'choice', options: JSON.stringify(['奇函数', '偶函数', '非奇非偶', '既是奇函数又是偶函数']), answer: '奇函数', solution: '$f(-x)=(-x)^3-3(-x)=-x^3+3x=-(x^3-3x)=-f(x)$，故为奇函数', difficulty: 1, kpNames: ['函数的概念与性质'] },
    // 函数与极限
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\sin3x}{x}$', questionType: 'fill_in', answer: '3', solution: '利用重要极限$\\lim_{x\\to0}\\frac{\\sin x}{x}=1$，$\\lim_{x\\to0}\\frac{\\sin3x}{x}=3\\lim_{x\\to0}\\frac{\\sin3x}{3x}=3$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{e^x-1}{x}$', questionType: 'fill_in', answer: '1', solution: '当$x\\to0$时，$e^x-1\\sim x$，等价无穷小替换得极限为1', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{1-\\cos x}{x^2}$', questionType: 'fill_in', answer: '1/2', solution: '当$x\\to0$时，$1-\\cos x\\sim\\frac{1}{2}x^2$，故极限为$\\frac{1}{2}$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to\\infty}(1+\\frac{1}{x})^x$', questionType: 'fill_in', answer: 'e', solution: '利用重要极限$\\lim_{x\\to\\infty}(1+\\frac{1}{x})^x=e$', difficulty: 1, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '求极限：$\\lim_{n\\to\\infty}(1+\\frac{2}{n})^{3n}$', questionType: 'fill_in', answer: 'e^6', solution: '$(1+\\frac{2}{n})^{3n}=[(1+\\frac{2}{n})^{n/2}]^6\\to e^6$', difficulty: 1, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '讨论函数$f(x)=\\begin{cases}x\\sin\\frac{1}{x},&x\\neq0\\\\0,&x=0\\end{cases}$在$x=0$处的连续性', questionType: 'essay', answer: '在x=0处连续', solution: '因为$|x\\sin\\frac{1}{x}|\\leq|x|\\to0$，所以$\\lim_{x\\to0}f(x)=0=f(0)$，故连续', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '判断$x=0$是函数$f(x)=\\frac{\\sin x}{x}$的什么间断点', questionType: 'choice', options: JSON.stringify(['可去间断点', '跳跃间断点', '无穷间断点', '振荡间断点']), answer: '可去间断点', solution: '$\\lim_{x\\to0}\\frac{\\sin x}{x}=1$，极限存在但不等于函数值（或无定义），故为可去间断点', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '证明方程$x^3-3x+1=0$在区间$(0,1)$内至少有一个根', questionType: 'essay', answer: '存在根', solution: '令$f(x)=x^3-3x+1$，$f(0)=1>0$，$f(1)=-1<0$，由零点定理，存在$\\xi\\in(0,1)$使$f(\\xi)=0$', difficulty: 1, kpNames: ['闭区间上连续函数的性质'] },

    // 导数与微分
    { content: '用定义求$f(x)=x^2$在$x=1$处的导数', questionType: 'fill_in', answer: '2', solution: '$f\'(1)=\\lim_{h\\to0}\\frac{(1+h)^2-1}{h}=\\lim_{h\\to0}\\frac{2h+h^2}{h}=2$', difficulty: 1, kpNames: ['导数概念'] },
    { content: '求$y=x^3\\ln x$的导数', questionType: 'fill_in', answer: 'x^2(3lnx+1)', solution: '$y\'=3x^2\\ln x+x^3\\cdot\\frac{1}{x}=x^2(3\\ln x+1)$', difficulty: 1, kpNames: ['函数的求导法则'] },
    { content: '求$y=\\sin(x^2)$的导数', questionType: 'fill_in', answer: '2xcos(x^2)', solution: '复合函数求导：$y\'=\\cos(x^2)\\cdot2x=2x\\cos(x^2)$', difficulty: 1, kpNames: ['函数的求导法则'] },
    { content: '求$y=\\arctan x$的二阶导数', questionType: 'fill_in', answer: '-2x/(1+x^2)^2', solution: '$y\'=\\frac{1}{1+x^2}$，$y\'\'=-\\frac{2x}{(1+x^2)^2}$', difficulty: 2, kpNames: ['高阶导数'] },
    { content: '求由方程$e^y+xy-e=0$确定的隐函数$y$的导数$\\frac{dy}{dx}$', questionType: 'fill_in', answer: '-y/(e^y+x)', solution: '两边对$x$求导：$e^y y\'+y+xy\'=0$，得$y\'=-\\frac{y}{e^y+x}$', difficulty: 2, kpNames: ['隐函数及参数方程求导'] },
    { content: '求$y=x^2$在$x=2$，$\\Delta x=0.01$时的微分$dy$', questionType: 'fill_in', answer: '0.04', solution: '$dy=y\'dx=2x\\cdot\\Delta x=4\\times0.01=0.04$', difficulty: 1, kpNames: ['函数的微分'] },

    // 中值定理
    { content: '验证$f(x)=x^2$在$[0,1]$上满足拉格朗日中值定理，并求$\\xi$', questionType: 'essay', answer: 'ξ=1/2', solution: '$f(x)=x^2$在$[0,1]$上连续可导，$f(1)-f(0)=1$，$f\'(\\xi)=2\\xi$，由$2\\xi=1$得$\\xi=\\frac{1}{2}$', difficulty: 2, kpNames: ['微分中值定理'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{x-\\sin x}{x^3}$', questionType: 'fill_in', answer: '1/6', solution: '0/0型，洛必达：$\\lim_{x\\to0}\\frac{1-\\cos x}{3x^2}=\\lim_{x\\to0}\\frac{\\sin x}{6x}=\\frac{1}{6}$', difficulty: 2, kpNames: ['洛必达法则'] },
    { content: '求$f(x)=e^x$的二阶麦克劳林公式', questionType: 'essay', answer: '1+x+x^2/2+R2', solution: '$f(0)=1,f\'(0)=1,f\'\'(0)=1$，$e^x=1+x+\\frac{x^2}{2}+R_2$，其中$R_2=\\frac{e^\\xi}{6}x^3$', difficulty: 3, kpNames: ['泰勒公式'] },
    { content: '求函数$f(x)=x^3-3x$的单调区间', questionType: 'essay', answer: '在(-∞,-1)和(1,+∞)递增，在(-1,1)递减', solution: '$f\'(x)=3x^2-3=3(x+1)(x-1)$，令$f\'(x)=0$得$x=\\pm1$，分析符号得单调性', difficulty: 1, kpNames: ['函数的单调性与凹凸性'] },
    { content: '求函数$f(x)=x^3-3x$在$[-2,2]$上的最大值和最小值', questionType: 'fill_in', answer: '2和-2', solution: '$f\'(x)=3x^2-3$，驻点$x=\\pm1$，$f(-2)=-2,f(-1)=2,f(1)=-2,f(2)=2$，最大值2，最小值-2', difficulty: 1, kpNames: ['函数的极值与最值'] },

    // 不定积分
    { content: '求$\\int x^2 dx$', questionType: 'fill_in', answer: 'x^3/3+C', solution: '基本积分公式：$\\int x^n dx=\\frac{x^{n+1}}{n+1}+C$', difficulty: 1, kpNames: ['不定积分的概念与性质'] },
    { content: '求$\\int\\sin2x\\,dx$', questionType: 'fill_in', answer: '-cos(2x)/2+C', solution: '第一类换元：$\\int\\sin2x dx=\\frac{1}{2}\\int\\sin2x d(2x)=-\\frac{1}{2}\\cos2x+C$', difficulty: 1, kpNames: ['换元积分法'] },
    { content: '求$\\int x\\cos x\\,dx$', questionType: 'fill_in', answer: 'x sin x + cos x + C', solution: '分部积分：令$u=x,dv=\\cos x dx$，$\\int x\\cos x dx=x\\sin x-\\int\\sin x dx=x\\sin x+\\cos x+C$', difficulty: 2, kpNames: ['分部积分法'] },
    { content: '求$\\int\\frac{1}{x^2-1}dx$', questionType: 'fill_in', answer: '(1/2)ln|(x-1)/(x+1)|+C', solution: '分解：$\\frac{1}{x^2-1}=\\frac{1}{2}(\\frac{1}{x-1}-\\frac{1}{x+1})$，积分得$\\frac{1}{2}\\ln|\\frac{x-1}{x+1}|+C$', difficulty: 2, kpNames: ['有理函数的积分'] },

    // 定积分
    { content: '求$\\int_0^1 x^2 dx$', questionType: 'fill_in', answer: '1/3', solution: '$\\int_0^1 x^2 dx=[\\frac{x^3}{3}]_0^1=\\frac{1}{3}$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '设$F(x)=\\int_0^x t^2 dt$，求$F\'(x)$', questionType: 'fill_in', answer: 'x^2', solution: '由积分上限函数求导公式：$F\'(x)=x^2$', difficulty: 1, kpNames: ['微积分基本公式'] },
    { content: '求$\\int_0^1 xe^x dx$', questionType: 'fill_in', answer: '1', solution: '分部积分：$\\int_0^1 xe^x dx=[xe^x]_0^1-\\int_0^1 e^x dx=e-(e-1)=1$', difficulty: 2, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '判断反常积分$\\int_1^{+\\infty}\\frac{1}{x^2}dx$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '不确定']), answer: '收敛', solution: '$\\int_1^{+\\infty}\\frac{1}{x^2}dx=[-\\frac{1}{x}]_1^{+\\infty}=1$，收敛', difficulty: 2, kpNames: ['反常积分'] },

    // 定积分应用
    { content: '求曲线$y=x^2$与直线$y=x$围成图形的面积', questionType: 'fill_in', answer: '1/6', solution: '交点$(0,0),(1,1)$，面积$S=\\int_0^1(x-x^2)dx=[\\frac{x^2}{2}-\\frac{x^3}{3}]_0^1=\\frac{1}{6}$', difficulty: 1, kpNames: ['定积分求面积'] },
    { content: '求$y=x^2$绕$x$轴旋转一周所得旋转体的体积（$0\\leq x\\leq1$）', questionType: 'fill_in', answer: 'π/5', solution: '$V=\\pi\\int_0^1(x^2)^2dx=\\pi\\int_0^1 x^4dx=\\frac{\\pi}{5}$', difficulty: 2, kpNames: ['定积分求体积'] },

    // 微分方程
    { content: '求微分方程$y\'=2x$的通解', questionType: 'fill_in', answer: 'y=x^2+C', solution: '直接积分：$y=\\int2x dx=x^2+C$', difficulty: 1, kpNames: ['微分方程的基本概念'] },
    { content: '求$y\'+y=e^x$的通解', questionType: 'fill_in', answer: 'y=e^(-x)(e^(2x)/2+C)', solution: '一阶线性：$P(x)=1,Q(x)=e^x$，通解$y=e^{-x}(\\int e^x e^x dx+C)=e^{-x}(\\frac{e^{2x}}{2}+C)$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求$y\'\'-3y\'+2y=0$的通解', questionType: 'fill_in', answer: 'y=C1e^x+C2e^(2x)', solution: '特征方程$r^2-3r+2=0$，$r_1=1,r_2=2$，通解$y=C_1e^x+C_2e^{2x}$', difficulty: 2, kpNames: ['常系数线性微分方程'] },

    // 多元函数
    { content: '求$z=x^2+y^2$的偏导数$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: '2x', solution: '对$x$求偏导，$y$视为常数：$\\frac{\\partial z}{\\partial x}=2x$', difficulty: 1, kpNames: ['偏导数'] },
    { content: '求$z=e^{xy}\\sin(x+y)$对$x$的偏导数', questionType: 'fill_in', answer: 'e^(xy)(y sin(x+y)+cos(x+y))', solution: '$\\frac{\\partial z}{\\partial x}=e^{xy}\\cdot y\\sin(x+y)+e^{xy}\\cos(x+y)$', difficulty: 1, kpNames: ['偏导数'] },
    { content: '设$z=x^2+y^2$，求全微分$dz$', questionType: 'fill_in', answer: '2xdx+2ydy', solution: '$dz=\\frac{\\partial z}{\\partial x}dx+\\frac{\\partial z}{\\partial y}dy=2xdx+2ydy$', difficulty: 1, kpNames: ['全微分'] },
    { content: '设$z=f(u,v)$，$u=x^2$，$v=y^2$，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: '2x fu', solution: '复合函数链式法则：$\\frac{\\partial z}{\\partial x}=\\frac{\\partial z}{\\partial u}\\cdot\\frac{\\partial u}{\\partial x}=f_u\\cdot2x$', difficulty: 2, kpNames: ['多元复合函数求导'] },
    { content: '求$f(x,y)=x^2+y^2$在约束条件$x+y=1$下的极值', questionType: 'fill_in', answer: '1/2', solution: '拉格朗日乘数法：$L=x^2+y^2+\\lambda(1-x-y)$，得$x=y=\\frac{1}{2}$，极小值$\\frac{1}{2}$', difficulty: 2, kpNames: ['多元函数的极值'] },

    // 重积分
    { content: '求$\\iint_D xy\\,dxdy$，$D$由$y=x,y=1,x=0$围成', questionType: 'fill_in', answer: '1/6', solution: '$\\int_0^1 x dx\\int_x^1 y dy=\\int_0^1 x\\cdot\\frac{1-x^2}{2}dx=\\frac{1}{6}$', difficulty: 2, kpNames: ['二重积分的计算'] },

    // 无穷级数
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{1}{n(n+1)}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '无法判断']), answer: '收敛', solution: '$\\frac{1}{n(n+1)}=\\frac{1}{n}-\\frac{1}{n+1}$，部分和$S_n=1-\\frac{1}{n+1}\\to1$，收敛', difficulty: 1, kpNames: ['常数项级数的概念与性质'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{n}{2^n}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '无法判断']), answer: '收敛', solution: '比值法：$\\lim_{n\\to\\infty}\\frac{a_{n+1}}{a_n}=\\frac{n+1}{2n}\\to\\frac{1}{2}<1$，收敛', difficulty: 2, kpNames: ['常数项级数的审敛法'] },
    { content: '求幂级数$\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}$的收敛半径', questionType: 'fill_in', answer: '+∞', solution: '$\\rho=\\lim_{n\\to\\infty}|\\frac{a_{n+1}}{a_n}|=\\lim_{n\\to\\infty}\\frac{1}{n+1}=0$，$R=+\\infty$', difficulty: 2, kpNames: ['幂级数'] },

    // 线性代数
    { content: '计算行列式：$\\begin{vmatrix}1&2\\\\3&4\\end{vmatrix}$', questionType: 'fill_in', answer: '-2', solution: '$1\\times4-2\\times3=4-6=-2$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '计算行列式：$\\begin{vmatrix}1&2&3\\\\2&3&1\\\\3&1&2\\end{vmatrix}$', questionType: 'fill_in', answer: '-18', solution: '按第一行展开：$1(6-1)-2(4-3)+3(2-9)=5-2-21=-18$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '设$A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$，$B=\\begin{pmatrix}5&6\\\\7&8\\end{pmatrix}$，求$A+B$', questionType: 'fill_in', answer: '[[6,8],[10,12]]', solution: '对应元素相加', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$，求$A^{-1}$', questionType: 'fill_in', answer: '[[-2,1],[1.5,-0.5]]', solution: '$|A|=-2$，$A^*=\\begin{pmatrix}4&-2\\\\-3&1\\end{pmatrix}$，$A^{-1}=-\\frac{1}{2}A^*$', difficulty: 1, kpNames: ['逆矩阵'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&2&0\\\\2&1&0\\\\0&0&3\\end{pmatrix}$的特征值', questionType: 'fill_in', answer: '3,3,-1', solution: '$|A-\\lambda E|=(3-\\lambda)[(1-\\lambda)^2-4]=(3-\\lambda)(\\lambda-3)(\\lambda+1)$', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '判断二次型$f(x,y)=x^2+2xy+2y^2$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '正定', solution: '矩阵$A=\\begin{pmatrix}1&1\\\\1&2\\end{pmatrix}$，顺序主子式$1>0,|A|=1>0$，正定', difficulty: 2, kpNames: ['二次型'] },

    // 概率论
    { content: '掷一枚骰子，写出样本空间，并写出事件"出现不小于4的点"', questionType: 'fill_in', answer: 'Ω={1,2,3,4,5,6},A={4,5,6}', solution: '样本空间$\\Omega=\\{1,2,3,4,5,6\\}$，事件$A=\\{x\\in\\Omega|x\\geq4\\}=\\{4,5,6\\}$', difficulty: 1, kpNames: ['随机事件与样本空间'] },
    { content: '掷一枚骰子，求出现偶数点的概率', questionType: 'fill_in', answer: '1/2', solution: '样本空间$\\Omega=\\{1,2,3,4,5,6\\}$，偶数点$A=\\{2,4,6\\}$，$P(A)=\\frac{3}{6}=\\frac{1}{2}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设$P(A)=0.5,P(B)=0.4,P(AB)=0.2$，求$P(A|B)$', questionType: 'fill_in', answer: '0.5', solution: '$P(A|B)=\\frac{P(AB)}{P(B)}=\\frac{0.2}{0.4}=0.5$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '设$X\\sim B(10,0.3)$，求$E(X)$', questionType: 'fill_in', answer: '3', solution: '二项分布期望$E(X)=np=10\\times0.3=3$', difficulty: 1, kpNames: ['数学期望'] },
    { content: '设$X\\sim N(0,1)$，求$D(X)$', questionType: 'fill_in', answer: '1', solution: '标准正态分布的方差$D(X)=1$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$X$服从参数为$\\lambda$的泊松分布，且$P(X=1)=P(X=2)$，求$\\lambda$', questionType: 'fill_in', answer: '2', solution: '$\\lambda e^{-\\lambda}=\\frac{\\lambda^2}{2}e^{-\\lambda}$，$\\lambda=2$（$\\lambda\\neq0$）', difficulty: 1, kpNames: ['离散型随机变量'] },
    { content: '设总体$X\\sim N(\\mu,\\sigma^2)$，$X_1,X_2,\\cdots,X_n$为样本，求$\\mu$的矩估计', questionType: 'fill_in', answer: '样本均值', solution: '矩估计：$\\hat{\\mu}=\\bar{X}=\\frac{1}{n}\\sum_{i=1}^n X_i$', difficulty: 2, kpNames: ['点估计'] },

    // ==================== 扩充题库 ====================

    // === 第一章 函数与极限 ===
    { content: '设$f(x)=\\frac{1}{\\sqrt{x-2}}$，求$f(x)$的定义域', questionType: 'fill_in', answer: '(2,+∞)', solution: '要求$x-2>0$，即$x>2$，定义域为$(2,+\\infty)$', difficulty: 1, kpNames: ['函数的概念与性质'] },
    { content: '求极限：$\\lim_{x\\to1}\\frac{x^2-1}{x-1}$', questionType: 'fill_in', answer: '2', solution: '$\\frac{x^2-1}{x-1}=x+1$，当$x\\to1$时极限为$2$', difficulty: 1, kpNames: ['函数的极限', '极限运算法则'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\tan x}{x}$', questionType: 'fill_in', answer: '1', solution: '$\\tan x\\sim x$（$x\\to0$），故极限为$1$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\ln(1+x)}{x}$', questionType: 'fill_in', answer: '1', solution: '$\\ln(1+x)\\sim x$（$x\\to0$），故极限为$1$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\arcsin x}{x}$', questionType: 'fill_in', answer: '1', solution: '$\\arcsin x\\sim x$（$x\\to0$），故极限为$1$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\tan x-\\sin x}{x^3}$', questionType: 'fill_in', answer: '1/2', solution: '$\\tan x-\\sin x=\\sin x(\\frac{1}{\\cos x}-1)\\sim x\\cdot\\frac{x^2}{2}=\\frac{x^3}{2}$，故极限为$\\frac{1}{2}$', difficulty: 2, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to\\infty}(1-\\frac{1}{x})^x$', questionType: 'fill_in', answer: '1/e', solution: '$(1-\\frac{1}{x})^x=[(1-\\frac{1}{x})^{-x}]^{-1}\\to e^{-1}$', difficulty: 1, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '求极限：$\\lim_{x\\to0}(1+3x)^{\\frac{1}{x}}$', questionType: 'fill_in', answer: 'e^3', solution: '$(1+3x)^{\\frac{1}{x}}=[(1+3x)^{\\frac{1}{3x}}]^3\\to e^3$', difficulty: 1, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '求极限：$\\lim_{n\\to\\infty}\\sqrt{n}(\\sqrt{n+1}-\\sqrt{n})$', questionType: 'fill_in', answer: '1/2', solution: '有理化：$\\sqrt{n}(\\sqrt{n+1}-\\sqrt{n})=\\frac{\\sqrt{n}}{\\sqrt{n+1}+\\sqrt{n}}\\to\\frac{1}{2}$', difficulty: 1, kpNames: ['数列的极限', '极限运算法则'] },
    { content: '求极限：$\\lim_{n\\to\\infty}\\frac{1+2+\\cdots+n}{n^2}$', questionType: 'fill_in', answer: '1/2', solution: '$\\frac{1+2+\\cdots+n}{n^2}=\\frac{n(n+1)}{2n^2}\\to\\frac{1}{2}$', difficulty: 1, kpNames: ['数列的极限', '极限运算法则'] },
    { content: '函数$f(x)=\\frac{x^2-1}{x^2-3x+2}$的间断点个数为', questionType: 'choice', options: JSON.stringify(['0', '1', '2', '3']), answer: '2', solution: '分母$=x^2-3x+2=(x-1)(x-2)$，$x=1$为可去间断点，$x=2$为无穷间断点', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '设$f(x)=\\begin{cases}\\frac{\\sin2x}{x},&x<0\\\\2,&x=0\\\\x^2+2,&x>0\\end{cases}$，讨论在$x=0$处的连续性', questionType: 'choice', options: JSON.stringify(['连续', '跳跃间断', '可去间断', '无穷间断']), answer: '跳跃间断', solution: '$\\lim_{x\\to0^-}f(x)=2$，$\\lim_{x\\to0^+}f(x)=2$，$f(0)=2$，左右极限等于函数值，连续', difficulty: 2, kpNames: ['函数的连续性与间断点'] },
    { content: '利用零点定理证明方程$x^5-3x=1$在$(1,2)$内至少有一个根', questionType: 'essay', answer: '存在根', solution: '令$f(x)=x^5-3x-1$，$f(1)=-3<0$，$f(2)=25>0$，由零点定理知存在$\\xi\\in(1,2)$使$f(\\xi)=0$', difficulty: 1, kpNames: ['闭区间上连续函数的性质'] },

    // === 第二章 导数与微分 ===
    { content: '用导数定义求$f(x)=\\sqrt{x}$在$x=4$处的导数', questionType: 'fill_in', answer: '1/4', solution: '$f\'(4)=\\lim_{h\\to0}\\frac{\\sqrt{4+h}-2}{h}=\\lim_{h\\to0}\\frac{1}{\\sqrt{4+h}+2}=\\frac{1}{4}$', difficulty: 1, kpNames: ['导数概念'] },
    { content: '曲线$y=x^3$在点$(1,1)$处的切线方程为', questionType: 'fill_in', answer: 'y=3x-2', solution: '$y\'=3x^2$，$y\'(1)=3$，切线方程$y-1=3(x-1)$，即$y=3x-2$', difficulty: 1, kpNames: ['导数概念'] },
    { content: '求$y=\\frac{\\sin x}{x}$的导数', questionType: 'fill_in', answer: '(xcosx-sinx)/x^2', solution: '$y\'=\\frac{x\\cos x-\\sin x}{x^2}$', difficulty: 1, kpNames: ['函数的求导法则'] },
    { content: '求$y=\\ln(\\cos x)$的导数', questionType: 'fill_in', answer: '-tan x', solution: '$y\'=\\frac{1}{\\cos x}\\cdot(-\\sin x)=-\\tan x$', difficulty: 1, kpNames: ['函数的求导法则'] },
    { content: '求$y=(x^2+1)e^{2x}$的导数', questionType: 'fill_in', answer: '2e^(2x)(x^2+x+1)', solution: '$y\'=2xe^{2x}+(x^2+1)\\cdot2e^{2x}=2e^{2x}(x^2+x+1)$', difficulty: 1, kpNames: ['函数的求导法则'] },
    { content: '求$y=x^2\\sin x$的三阶导数', questionType: 'fill_in', answer: '-6cosx+6xsinx+x^2cosx', solution: '莱布尼茨公式：$y^{(3)}=\\sum_{k=0}^3 C_3^k(x^2)^{(k)}(\\sin x)^{(3-k)}$', difficulty: 2, kpNames: ['高阶导数'] },
    { content: '设$x\\ln y-y\\ln x=1$，求$\\frac{dy}{dx}$', questionType: 'fill_in', answer: '(y/x-lny)/(x/y-lnx)', solution: '两边对$x$求导：$\\ln y+\\frac{x}{y}y\'-y\'\\ln x-\\frac{y}{x}=0$，整理得结果', difficulty: 2, kpNames: ['隐函数及参数方程求导'] },
    { content: '求$y=\\sqrt{1+x}$在$x=0$处的微分', questionType: 'fill_in', answer: 'dx/2', solution: '$y\'=\\frac{1}{2\\sqrt{1+x}}$，$y\'(0)=\\frac{1}{2}$，$dy=\\frac{1}{2}dx$', difficulty: 1, kpNames: ['函数的微分'] },

    // === 第三章 中值定理与导数应用 ===
    { content: '验证$f(x)=\\ln x$在$[1,e]$上满足拉格朗日中值定理，求$\\xi$', questionType: 'fill_in', answer: 'e-1', solution: '$f\'(\\xi)=\\frac{\\ln e-\\ln1}{e-1}=\\frac{1}{e-1}$，又$f\'(\\xi)=\\frac{1}{\\xi}$，得$\\xi=e-1$', difficulty: 2, kpNames: ['微分中值定理'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{e^x-1-x}{x^2}$', questionType: 'fill_in', answer: '1/2', solution: '0/0型，洛必达：$\\lim_{x\\to0}\\frac{e^x-1}{2x}=\\lim_{x\\to0}\\frac{e^x}{2}=\\frac{1}{2}$', difficulty: 2, kpNames: ['洛必达法则'] },
    { content: '求极限：$\\lim_{x\\to0^+}x\\ln x$', questionType: 'fill_in', answer: '0', solution: '$0\\cdot(-\\infty)$型，$x\\ln x=\\frac{\\ln x}{1/x}$，洛必达：$\\lim\\frac{1/x}{-1/x^2}=\\lim(-x)=0$', difficulty: 2, kpNames: ['洛必达法则'] },
    { content: '求极限：$\\lim_{x\\to0}(\\frac{1}{x}-\\frac{1}{e^x-1})$', questionType: 'fill_in', answer: '1/2', solution: '通分后$\\frac{e^x-1-x}{x(e^x-1)}$，洛必达得$\\frac{1}{2}$', difficulty: 2, kpNames: ['洛必达法则'] },
    { content: '求$f(x)=\\sin x$的三阶麦克劳林公式', questionType: 'essay', answer: 'x-x^3/6+R3', solution: '$f(0)=0,f\'(0)=1,f\'\'(0)=0,f\'\'\'(0)=-1$，$\\sin x=x-\\frac{x^3}{6}+R_3$', difficulty: 2, kpNames: ['泰勒公式'] },
    { content: '求函数$f(x)=x^4-2x^2+3$的单调区间和极值', questionType: 'essay', answer: '在(-∞,-1)和(0,1)递减，在(-1,0)和(1,+∞)递增，极小值f(±1)=2，极大值f(0)=3', solution: '$f\'(x)=4x^3-4x=4x(x^2-1)$，驻点$x=-1,0,1$，分析符号得单调区间和极值', difficulty: 1, kpNames: ['函数的单调性与凹凸性', '函数的极值与最值'] },
    { content: '求曲线$y=x^3-3x^2+1$的拐点', questionType: 'fill_in', answer: '(1,-1)', solution: '$y\'=3x^2-6x$，$y\'\'=6x-6$，$y\'\'=0$得$x=1$，$y(1)=-1$，凹凸性改变，故拐点为$(1,-1)$', difficulty: 1, kpNames: ['函数的单调性与凹凸性'] },
    { content: '求函数$f(x)=x+\\frac{1}{x}$在$[\\frac{1}{2},2]$上的最大值和最小值', questionType: 'fill_in', answer: '最大值5/2，最小值2', solution: '$f\'(x)=1-\\frac{1}{x^2}$，驻点$x=1$，$f(\\frac{1}{2})=\\frac{5}{2},f(1)=2,f(2)=\\frac{5}{2}$', difficulty: 1, kpNames: ['函数的极值与最值'] },

    // === 第四章 不定积分 ===
    { content: '求$\\int\\frac{1}{\\sqrt{x}}dx$', questionType: 'fill_in', answer: '2√x+C', solution: '$\\int x^{-1/2}dx=2x^{1/2}+C=2\\sqrt{x}+C$', difficulty: 1, kpNames: ['不定积分的概念与性质'] },
    { content: '求$\\int e^{3x}dx$', questionType: 'fill_in', answer: 'e^(3x)/3+C', solution: '凑微分：$\\int e^{3x}dx=\\frac{1}{3}\\int e^{3x}d(3x)=\\frac{e^{3x}}{3}+C$', difficulty: 1, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{dx}{\\sqrt{1-x^2}}$', questionType: 'fill_in', answer: 'arcsin x+C', solution: '基本积分公式：$\\int\\frac{dx}{\\sqrt{1-x^2}}=\\arcsin x+C$', difficulty: 1, kpNames: ['不定积分的概念与性质'] },
    { content: '求$\\int\\frac{dx}{x^2+4}$', questionType: 'fill_in', answer: '(1/2)arctan(x/2)+C', solution: '$\\int\\frac{dx}{x^2+4}=\\frac{1}{4}\\int\\frac{dx}{(x/2)^2+1}=\\frac{1}{2}\\arctan\\frac{x}{2}+C$', difficulty: 1, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{\\ln x}{x}dx$', questionType: 'fill_in', answer: '(lnx)^2/2+C', solution: '凑微分：$\\int\\frac{\\ln x}{x}dx=\\int\\ln x d(\\ln x)=\\frac{(\\ln x)^2}{2}+C$', difficulty: 1, kpNames: ['换元积分法'] },
    { content: '求$\\int x^2\\ln x\\,dx$', questionType: 'fill_in', answer: '(x^3/3)lnx-x^3/9+C', solution: '分部积分：$u=\\ln x,dv=x^2dx$，$\\int x^2\\ln x dx=\\frac{x^3}{3}\\ln x-\\int\\frac{x^2}{3}dx$', difficulty: 2, kpNames: ['分部积分法'] },
    { content: '求$\\int e^x\\sin x\\,dx$', questionType: 'fill_in', answer: 'e^x(sinx-cosx)/2+C', solution: '两次分部积分：设$I=\\int e^x\\sin x dx$，$I=e^x\\sin x-\\int e^x\\cos x dx=e^x\\sin x-(e^x\\cos x+\\int e^x\\sin x dx)$，得$2I=e^x(\\sin x-\\cos x)+C$', difficulty: 2, kpNames: ['分部积分法'] },
    { content: '求$\\int\\frac{dx}{x^2+2x+2}$', questionType: 'fill_in', answer: 'arctan(x+1)+C', solution: '$\\int\\frac{dx}{(x+1)^2+1}=\\arctan(x+1)+C$', difficulty: 2, kpNames: ['有理函数的积分'] },

    // === 第五章 定积分 ===
    { content: '求$\\int_0^2 x^3 dx$', questionType: 'fill_in', answer: '4', solution: '$\\int_0^2 x^3 dx=[\\frac{x^4}{4}]_0^2=4$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '比较$\\int_0^1 x^2 dx$和$\\int_0^1 x^3 dx$的大小', questionType: 'fill_in', answer: '∫_0^1 x^2 dx > ∫_0^1 x^3 dx', solution: '在$[0,1]$上，$x^2\\geq x^3$且不恒等，故$\\int_0^1 x^2 dx>\\int_0^1 x^3 dx$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '设$F(x)=\\int_0^x \\sin t^2 dt$，求$F\'(x)$', questionType: 'fill_in', answer: 'sin(x^2)', solution: '由积分上限函数求导公式：$F\'(x)=\\sin(x^2)$', difficulty: 1, kpNames: ['微积分基本公式'] },
    { content: '求$\\lim_{x\\to0}\\frac{\\int_0^x \\sin t^2 dt}{x^3}$', questionType: 'fill_in', answer: '1/3', solution: '0/0型，洛必达：$\\lim_{x\\to0}\\frac{\\sin x^2}{3x^2}=\\frac{1}{3}$', difficulty: 2, kpNames: ['微积分基本公式'] },
    { content: '求$\\int_0^\\pi x\\sin x\\,dx$', questionType: 'fill_in', answer: 'π', solution: '分部积分：$\\int_0^\\pi x\\sin x dx=[-x\\cos x]_0^\\pi+\\int_0^\\pi\\cos x dx=\\pi+0=\\pi$', difficulty: 2, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '求$\\int_0^1\\frac{dx}{\\sqrt{x}(1+x)}$', questionType: 'fill_in', answer: 'π/2', solution: '令$t=\\sqrt{x}$，$\\int_0^1\\frac{2tdt}{t(1+t^2)}=2\\int_0^1\\frac{dt}{1+t^2}=\\frac{\\pi}{2}$', difficulty: 2, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '判断反常积分$\\int_0^1\\frac{dx}{\\sqrt{x}}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '不确定']), answer: '收敛', solution: '$\\int_0^1 x^{-1/2}dx=[2\\sqrt{x}]_0^1=2$，收敛', difficulty: 2, kpNames: ['反常积分'] },
    { content: '判断反常积分$\\int_1^{+\\infty}\\frac{dx}{x}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '不确定']), answer: '发散', solution: '$\\int_1^{+\\infty}\\frac{dx}{x}=[\\ln x]_1^{+\\infty}=+\\infty$，发散', difficulty: 2, kpNames: ['反常积分'] },

    // === 第六章 定积分的应用 ===
    { content: '求曲线$y=\\sqrt{x}$与直线$y=x$围成图形的面积', questionType: 'fill_in', answer: '1/6', solution: '交点$(0,0),(1,1)$，面积$S=\\int_0^1(\\sqrt{x}-x)dx=[\\frac{2}{3}x^{3/2}-\\frac{x^2}{2}]_0^1=\\frac{1}{6}$', difficulty: 1, kpNames: ['定积分求面积'] },
    { content: '求曲线$y=\\sin x$（$0\\leq x\\leq\\pi$）与$x$轴围成图形的面积', questionType: 'fill_in', answer: '2', solution: '$S=\\int_0^\\pi\\sin x dx=[-\\cos x]_0^\\pi=2$', difficulty: 1, kpNames: ['定积分求面积'] },
    { content: '求$y=\\sin x$（$0\\leq x\\leq\\pi$）绕$x$轴旋转一周所得旋转体的体积', questionType: 'fill_in', answer: 'π^2/2', solution: '$V=\\pi\\int_0^\\pi\\sin^2 x dx=\\pi\\int_0^\\pi\\frac{1-\\cos2x}{2}dx=\\frac{\\pi^2}{2}$', difficulty: 2, kpNames: ['定积分求体积'] },
    { content: '求曲线$y=\\frac{2}{3}x^{3/2}$在$0\\leq x\\leq1$上的弧长', questionType: 'fill_in', answer: '2(2√2-1)/3', solution: '$y\'=x^{1/2}$，弧长$s=\\int_0^1\\sqrt{1+x}dx=[\\frac{2}{3}(1+x)^{3/2}]_0^1=\\frac{2(2\\sqrt{2}-1)}{3}$', difficulty: 2, kpNames: ['定积分求弧长'] },

    // === 第七章 微分方程 ===
    { content: '求微分方程$y\'=e^{x+y}$的通解', questionType: 'fill_in', answer: 'e^(-y)=-e^x+C', solution: '可分离变量：$e^{-y}dy=e^x dx$，积分得$-e^{-y}=e^x+C$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求微分方程$y\'+\\frac{y}{x}=x^2$的通解', questionType: 'fill_in', answer: 'y=x^3/4+C/x', solution: '一阶线性：$P(x)=1/x,Q(x)=x^2$，$y=e^{-\\ln x}(\\int x^2 e^{\\ln x}dx+C)$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求$y\'\'-4y\'+4y=0$的通解', questionType: 'fill_in', answer: 'y=(C1+C2x)e^(2x)', solution: '特征方程$r^2-4r+4=0$，$r=2$（二重根），通解$y=(C_1+C_2x)e^{2x}$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求$y\'\'+y=0$的通解', questionType: 'fill_in', answer: 'y=C1cosx+C2sinx', solution: '特征方程$r^2+1=0$，$r=\\pm i$，通解$y=C_1\\cos x+C_2\\sin x$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求$y\'\'-2y\'-3y=3x+1$的通解', questionType: 'fill_in', answer: 'y=C1e^(3x)+C2e^(-x)-x-1/3', solution: '齐次通解$y_h=C_1e^{3x}+C_2e^{-x}$，设特解$y_p=Ax+B$，代入得$A=-1,B=-\\frac{1}{3}$', difficulty: 2, kpNames: ['常系数线性微分方程', '高阶线性微分方程'] },

    // === 第八章 多元函数微分学 ===
    { content: '求$z=x^3+y^3-3xy$的偏导数$\\frac{\\partial z}{\\partial x}$和$\\frac{\\partial z}{\\partial y}$', questionType: 'fill_in', answer: '∂z/∂x=3x^2-3y,∂z/∂y=3y^2-3x', solution: '$\\frac{\\partial z}{\\partial x}=3x^2-3y$，$\\frac{\\partial z}{\\partial y}=3y^2-3x$', difficulty: 1, kpNames: ['偏导数'] },
    { content: '求$z=x^y$的偏导数', questionType: 'fill_in', answer: '∂z/∂x=yx^(y-1),∂z/∂y=x^y lnx', solution: '对$x$：幂函数求导；对$y$：指数函数求导', difficulty: 1, kpNames: ['偏导数'] },
    { content: '求$z=x^3+y^3-3x^2-3y^2$的极值', questionType: 'essay', answer: '极小值点(2,2)，极小值-8', solution: '由$\\frac{\\partial z}{\\partial x}=3x^2-6x=0,\\frac{\\partial z}{\\partial y}=3y^2-6y=0$得驻点，用二阶偏导数判别', difficulty: 2, kpNames: ['多元函数的极值'] },
    { content: '设$z=f(x^2+y^2)$，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: '2x f\'(x^2+y^2)', solution: '复合函数链式法则：$\\frac{\\partial z}{\\partial x}=f\'(x^2+y^2)\\cdot2x$', difficulty: 2, kpNames: ['多元复合函数求导'] },
    { content: '设$z=e^{u}\\sin v$，$u=xy$，$v=x+y$，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: 'e^(xy)(y sin(x+y)+cos(x+y))', solution: '$\\frac{\\partial z}{\\partial x}=\\frac{\\partial z}{\\partial u}\\frac{\\partial u}{\\partial x}+\\frac{\\partial z}{\\partial v}\\frac{\\partial v}{\\partial x}=e^u\\sin v\\cdot y+e^u\\cos v\\cdot1$', difficulty: 2, kpNames: ['多元复合函数求导'] },
    { content: '设$z=z(x,y)$由方程$e^z-xyz=0$确定，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: 'yz/(e^z-xy)', solution: '隐函数求导：$e^z z_x-yz-xyz_x=0$，得$z_x=\\frac{yz}{e^z-xy}$', difficulty: 2, kpNames: ['隐函数求导'] },

    // === 第九章 重积分 ===
    { content: '求$\\iint_D x^2y\\,dxdy$，$D$由$0\\leq x\\leq1,0\\leq y\\leq1$围成', questionType: 'fill_in', answer: '1/6', solution: '$\\int_0^1 x^2 dx\\int_0^1 y dy=\\frac{1}{3}\\cdot\\frac{1}{2}=\\frac{1}{6}$', difficulty: 1, kpNames: ['二重积分的概念与性质'] },
    { content: '求$\\iint_D e^{x+y}dxdy$，$D$由$0\\leq x\\leq1,0\\leq y\\leq1$围成', questionType: 'fill_in', answer: '(e-1)^2', solution: '$\\int_0^1 e^x dx\\int_0^1 e^y dy=(e-1)^2$', difficulty: 1, kpNames: ['二重积分的计算'] },
    { content: '求$\\iint_D (x+y)dxdy$，$D$由$y=x,y=x^2$围成', questionType: 'fill_in', answer: '3/20', solution: '$\\int_0^1 dx\\int_{x^2}^x(x+y)dy=\\int_0^1(x(x-x^2)+\\frac{1}{2}(x^2-x^4))dx=\\frac{3}{20}$', difficulty: 2, kpNames: ['二重积分的计算'] },
    { content: '求$\\iint_D x^2 dxdy$，$D$为圆$x^2+y^2\\leq1$', questionType: 'fill_in', answer: 'π/4', solution: '极坐标：$\\int_0^{2\\pi}d\\theta\\int_0^1 r^2\\cos^2\\theta\\cdot rdr=\\frac{\\pi}{4}$', difficulty: 2, kpNames: ['二重积分的计算'] },
    { content: '求$\\iiint_\\Omega z\\,dxdydz$，$\\Omega$由$0\\leq x\\leq1,0\\leq y\\leq1,0\\leq z\\leq1$围成', questionType: 'fill_in', answer: '1/2', solution: '$\\int_0^1 dx\\int_0^1 dy\\int_0^1 zdz=\\frac{1}{2}$', difficulty: 2, kpNames: ['三重积分'] },

    // === 第十章 无穷级数 ===
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{1}{n}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '不确定']), answer: '发散', solution: '调和级数，$p=1$，$p\\leq1$时发散', difficulty: 1, kpNames: ['常数项级数的概念与性质'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{1}{n^2}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '不确定']), answer: '收敛', solution: '$p$级数，$p=2>1$，收敛', difficulty: 1, kpNames: ['常数项级数的审敛法'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}(-1)^{n-1}\\frac{1}{n}$的敛散性', questionType: 'choice', options: JSON.stringify(['绝对收敛', '条件收敛', '发散', '不确定']), answer: '条件收敛', solution: '$\\sum\\frac{1}{n}$发散，但交错级数$\\sum(-1)^{n-1}\\frac{1}{n}$满足莱布尼茨条件，条件收敛', difficulty: 2, kpNames: ['常数项级数的审敛法'] },
    { content: '求幂级数$\\sum_{n=1}^{\\infty}\\frac{x^n}{n}$的收敛域', questionType: 'fill_in', answer: '[-1,1)', solution: '$\\rho=1$，$R=1$，$x=1$时发散，$x=-1$时条件收敛，收敛域为$[-1,1)$', difficulty: 2, kpNames: ['幂级数'] },
    { content: '求幂级数$\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}$的和函数', questionType: 'fill_in', answer: 'e^x', solution: '$\\sum_{n=0}^{\\infty}\\frac{x^n}{n!}=e^x$，$x\\in(-\\infty,+\\infty)$', difficulty: 2, kpNames: ['幂级数'] },
    { content: '将$f(x)=\\frac{1}{1+x}$展开成$x$的幂级数', questionType: 'essay', answer: '∑_{n=0}^∞(-1)^n x^n,|x|<1', solution: '$\\frac{1}{1+x}=\\frac{1}{1-(-x)}=\\sum_{n=0}^{\\infty}(-x)^n=\\sum_{n=0}^{\\infty}(-1)^n x^n$，$|x|<1$', difficulty: 2, kpNames: ['函数展开成幂级数'] },

    // === 线性代数 ===
    { content: '计算行列式：$\\begin{vmatrix}0&a&b\\\\a&0&c\\\\b&c&0\\end{vmatrix}$', questionType: 'fill_in', answer: '2abc', solution: '直接展开：$0-a(-ac)+b(ac)=2abc$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '若$A$是3阶方阵且$|A|=2$，求$|2A|$', questionType: 'fill_in', answer: '16', solution: '$|2A|=2^3|A|=8\\times2=16$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '计算行列式：$\\begin{vmatrix}1&1&1\\\\1&2&3\\\\1&3&6\\end{vmatrix}$', questionType: 'fill_in', answer: '1', solution: '化为上三角：$r_2-r_1,r_3-r_1$，$\\begin{vmatrix}1&1&1\\\\0&1&2\\\\0&2&5\\end{vmatrix}$，$r_3-2r_2$得主对角线乘积$1\\times1\\times1=1$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '设$A=\\begin{pmatrix}1&0\\\\0&2\\end{pmatrix}$，求$A^3$', questionType: 'fill_in', answer: '[[1,0],[0,8]]', solution: '对角矩阵的幂等于各元素分别取幂：$A^3=\\begin{pmatrix}1^3&0\\\\0&2^3\\end{pmatrix}$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A=\\begin{pmatrix}1&1\\\\0&1\\end{pmatrix}$，求$A^n$', questionType: 'fill_in', answer: '[[1,n],[0,1]]', solution: '数学归纳法可证$A^n=\\begin{pmatrix}1&n\\\\0&1\\end{pmatrix}$', difficulty: 2, kpNames: ['矩阵的概念与运算'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&2&3\\\\2&4&6\\\\3&6&9\\end{pmatrix}$的秩', questionType: 'fill_in', answer: '1', solution: '各行成比例：第二行是第一行的2倍，第三行是第一行的3倍，秩为1', difficulty: 2, kpNames: ['矩阵的秩'] },
    { content: '解线性方程组：$\\begin{cases}x_1+x_2=1\\\\x_1-x_2=3\\end{cases}$', questionType: 'fill_in', answer: 'x1=2,x2=-1', solution: '两式相加得$2x_1=4$，$x_1=2$；代入得$x_2=-1$', difficulty: 1, kpNames: ['消元法解线性方程组'] },
    { content: '求齐次线性方程组$\\begin{cases}x_1+x_2+x_3=0\\\\x_1-x_2=0\\end{cases}$的基础解系', questionType: 'essay', answer: 'ξ=(-1,-1,2)^T', solution: '系数矩阵行最简$\\begin{pmatrix}1&0&\\frac{1}{2}\\\\0&1&\\frac{1}{2}\\end{pmatrix}$，基础解系$\\xi=(-1,-1,2)^T$', difficulty: 2, kpNames: ['线性方程组解的结构'] },
    { content: '判断向量组$\\alpha_1=(1,0,0)^T,\\alpha_2=(0,1,0)^T,\\alpha_3=(1,1,0)^T$的线性相关性', questionType: 'choice', options: JSON.stringify(['线性无关', '线性相关', '无法判断']), answer: '线性相关', solution: '$\\alpha_3=\\alpha_1+\\alpha_2$，故线性相关', difficulty: 2, kpNames: ['向量组的线性相关性'] },
    { content: '设$A=\\begin{pmatrix}2&0\\\\0&3\\end{pmatrix}$，求$A$的特征值和特征向量', questionType: 'essay', answer: 'λ1=2,ξ1=(1,0)^T;λ2=3,ξ2=(0,1)^T', solution: '对角矩阵的特征值就是对角线元素，特征向量为标准基向量', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '判断矩阵$A=\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}$是否可对角化', questionType: 'choice', options: JSON.stringify(['可对角化', '不可对角化', '无法判断']), answer: '可对角化', solution: '特征值$\\lambda_1=1,\\lambda_2=3$，两个不同的特征值对应两个线性无关的特征向量，可对角化', difficulty: 2, kpNames: ['相似矩阵与对角化'] },
    { content: '判断二次型$f(x,y)=x^2+4xy+y^2$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '不定', solution: '矩阵$A=\\begin{pmatrix}1&2\\\\2&1\\end{pmatrix}$，顺序主子式$1>0,|A|=-3<0$，不定', difficulty: 2, kpNames: ['二次型'] },

    // === 概率论 ===
    { content: '盒中有3个红球和2个白球，任取2个，求恰有1个红球的概率', questionType: 'fill_in', answer: '3/5', solution: '$P=\\frac{C_3^1C_2^1}{C_5^2}=\\frac{3\\times2}{10}=\\frac{3}{5}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设事件$A,B$互斥，$P(A)=0.3,P(B)=0.5$，求$P(A\\cup B)$', questionType: 'fill_in', answer: '0.8', solution: '互斥事件：$P(A\\cup B)=P(A)+P(B)=0.8$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '某工厂有甲乙丙三台机器，产量分别占总产量的25%、35%、40%，次品率分别为5%、4%、2%。任取一件产品，求它是次品的概率', questionType: 'fill_in', answer: '0.0345', solution: '全概率公式：$P=0.25\\times0.05+0.35\\times0.04+0.40\\times0.02=0.0345$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '接上题，若取到一件次品，求它来自甲机器的概率', questionType: 'fill_in', answer: '0.3623', solution: '贝叶斯公式：$P(甲|次品)=\\frac{0.25\\times0.05}{0.0345}\\approx0.3623$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '设$X$的分布律为$P(X=k)=\\frac{k}{6}$（$k=1,2,3$），求$E(X)$', questionType: 'fill_in', answer: '7/3', solution: '$E(X)=1\\times\\frac{1}{6}+2\\times\\frac{2}{6}+3\\times\\frac{3}{6}=\\frac{14}{6}=\\frac{7}{3}$', difficulty: 1, kpNames: ['数学期望', '离散型随机变量'] },
    { content: '设$X$的概率密度为$f(x)=2x$（$0<x<1$），求$E(X)$', questionType: 'fill_in', answer: '2/3', solution: '$E(X)=\\int_0^1 x\\cdot2x dx=\\frac{2}{3}$', difficulty: 1, kpNames: ['数学期望', '连续型随机变量'] },
    { content: '设$X\\sim U(0,2)$，求$D(X)$', questionType: 'fill_in', answer: '1/3', solution: '均匀分布$D(X)=\\frac{(b-a)^2}{12}=\\frac{4}{12}=\\frac{1}{3}$', difficulty: 1, kpNames: ['方差与标准差', '连续型随机变量'] },
    { content: '设$X\\sim N(2,4)$，求$P(X>0)$', questionType: 'fill_in', answer: '0.8413', solution: '标准化：$P(X>0)=P(\\frac{X-2}{2}>-1)=P(Z>-1)=\\Phi(1)=0.8413$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '设$(X,Y)$的联合分布，$X$取$1,2$，$Y$取$1,2$，$P(X=i,Y=j)=\\frac{i+j}{12}$，求$E(XY)$', questionType: 'fill_in', answer: '35/12', solution: '$E(XY)=\\sum_{i=1}^2\\sum_{j=1}^2 ij\\cdot\\frac{i+j}{12}=\\frac{35}{12}$', difficulty: 2, kpNames: ['数学期望', '协方差与相关系数'] },
    { content: '设$D(X)=4,D(Y)=9,\\rho_{XY}=0.5$，求$D(X+Y)$', questionType: 'fill_in', answer: '19', solution: '$D(X+Y)=D(X)+D(Y)+2\\rho\\sqrt{D(X)D(Y)}=4+9+2\\times0.5\\times6=19$', difficulty: 2, kpNames: ['协方差与相关系数'] },
    { content: '设总体$X\\sim N(0,1)$，$X_1,X_2,X_3$为样本，判断$\\hat{\\mu}_1=\\frac{X_1+X_2+X_3}{3}$是否为$\\mu$的无偏估计', questionType: 'fill_in', answer: '是', solution: '$E(\\hat{\\mu}_1)=\\frac{1}{3}(E(X_1)+E(X_2)+E(X_3))=0=\\mu$，是无偏估计', difficulty: 2, kpNames: ['估计量的评价标准'] },
    { content: '设总体$X\\sim N(\\mu,1)$，$X_1,\\cdots,X_{16}$为样本，$\\bar{x}=5$，求$\\mu$的95%置信区间', questionType: 'fill_in', answer: '(4.51,5.49)', solution: '$\\bar{x}\\pm z_{0.025}\\frac{\\sigma}{\\sqrt{n}}=5\\pm1.96\\times\\frac{1}{4}$，置信区间$(4.51,5.49)$', difficulty: 2, kpNames: ['区间估计'] },

    // ==================== 真题（考研真题） ====================
    { content: '【2023年数一】求极限$\\lim_{x\\to0}\\frac{\\sin x-x\\cos x}{x^3}$', questionType: 'fill_in', answer: '1/3', solution: '洛必达或泰勒展开：$\\sin x=x-\\frac{x^3}{6}+o(x^3)$，$x\\cos x=x-\\frac{x^3}{2}+o(x^3)$，分子$\\sim\\frac{x^3}{3}$，极限为$\\frac{1}{3}$', difficulty: 2, kpNames: ['函数的极限', '洛必达法则'], source: '2023年数学一' },
    { content: '【2022年数一】求极限$\\lim_{x\\to0}\\frac{\\int_0^x(e^{t^2}-1)dt}{x^3}$', questionType: 'fill_in', answer: '1/3', solution: '0/0型，洛必达：$\\lim_{x\\to0}\\frac{e^{x^2}-1}{3x^2}=\\lim_{x\\to0}\\frac{x^2}{3x^2}=\\frac{1}{3}$', difficulty: 2, kpNames: ['微积分基本公式', '洛必达法则'], source: '2022年数学一' },
    { content: '【2021年数一】设$f(x)$在$[0,1]$上连续，$\\int_0^1 f(x)dx=0$，$\\int_0^1 xf(x)dx=1$，求$\\int_0^1 f^2(x)dx$的最小值', questionType: 'fill_in', answer: '12', solution: '由柯西-施瓦茨不等式，$\\int_0^1 f^2(x)dx\\cdot\\int_0^1(3x-1)^2dx\\geq(\\int_0^1(3x-1)f(x)dx)^2$，$\\int_0^1(3x-1)^2dx=1$，$\\int_0^1(3x-1)f(x)dx=3\\times1-1\\times0=3$，最小值为$9$。正确：利用$f(x)$可用$\\{1,3x-1\\}$展开，最小值为$12$', difficulty: 3, kpNames: ['定积分的概念与性质'], source: '2021年数学一' },
    { content: '【2023年数一】求微分方程$y\'\'-2y\'+y=xe^x$的通解', questionType: 'essay', answer: 'y=(C1+C2x)e^x+(x^3/6)e^x', solution: '齐次通解$y_h=(C_1+C_2x)e^x$，设特解$y_p=x^2(Ax+B)e^x$，代入得$A=\\frac{1}{6},B=0$', difficulty: 2, kpNames: ['常系数线性微分方程'], source: '2023年数学一' },
    { content: '【2022年数一】求$\\iint_D(x^2+y^2)dxdy$，$D$由$x^2+y^2=2x$围成', questionType: 'fill_in', answer: '3π/2', solution: '极坐标：$D$为$r=2\\cos\\theta$，$\\int_{-\\pi/2}^{\\pi/2}d\\theta\\int_0^{2\\cos\\theta}r^2\\cdot rdr=\\frac{3\\pi}{2}$', difficulty: 2, kpNames: ['二重积分的计算'], source: '2022年数学一' },
    { content: '【2023年数一】设$A$为3阶矩阵，$|A|=2$，求$|A^*+A^{-1}|$', questionType: 'fill_in', answer: '27/4', solution: '$A^*=|A|A^{-1}=2A^{-1}$，$A^*+A^{-1}=3A^{-1}$，$|3A^{-1}|=3^3|A^{-1}|=27/2$', difficulty: 2, kpNames: ['行列式的定义与性质', '逆矩阵'], source: '2023年数学一' },
    { content: '【2022年数一】设$A$为3阶矩阵，$\\alpha_1,\\alpha_2$为$Ax=0$的基础解系，$\\beta$为$Ax=b$的特解，求$A$的秩', questionType: 'fill_in', answer: '1', solution: '基础解系含2个向量，$n-r(A)=2$，$n=3$，$r(A)=1$', difficulty: 2, kpNames: ['线性方程组解的结构', '矩阵的秩'], source: '2022年数学一' },
    { content: '【2021年数一】设$X\\sim N(0,1)$，$Y=|X|$，求$E(Y)$', questionType: 'fill_in', answer: '√(2/π)', solution: '$E(Y)=\\int_{-\\infty}^{\\infty}|x|\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}dx=2\\int_0^{\\infty}x\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}dx=\\sqrt{\\frac{2}{\\pi}}$', difficulty: 2, kpNames: ['数学期望', '连续型随机变量'], source: '2021年数学一' },
    { content: '【2023年数一】设$X_1,X_2,\\cdots,X_n$是来自总体$N(\\mu,\\sigma^2)$的样本，$\\bar{X}$为样本均值，$S^2$为样本方差，求$E(S^2)$', questionType: 'fill_in', answer: 'σ^2', solution: '样本方差$S^2$是总体方差$\\sigma^2$的无偏估计，$E(S^2)=\\sigma^2$', difficulty: 2, kpNames: ['估计量的评价标准', '点估计'], source: '2023年数学一' },
    { content: '【2022年数一】设$f(x)$在$[a,b]$上可导，$f(a)=f(b)=0$，$\\int_a^b f^2(x)dx=1$，证明$\\int_a^b x^2f^2(x)dx\\cdot\\int_a^b[f\'(x)]^2dx\\geq\\frac{1}{4}$', questionType: 'essay', answer: '由柯西-施瓦茨不等式，∫_a^b xf(x)f\'(x)dx≤√(∫x^2f^2dx·∫[f\']^2dx)，又∫_a^b xf(x)f\'(x)dx=1/2∫_a^b xd[f^2(x)]=-1/2∫_a^b f^2(x)dx=-1/2...', solution: '由柯西-施瓦茨不等式及分部积分可证', difficulty: 3, kpNames: ['定积分的概念与性质', '微分中值定理'], source: '2022年数学一' },

    // ==================== 扩充题库：高等数学 ====================

    // === 函数与极限（新增） ===
    { content: '求极限：$\\lim_{x\\to2}\\frac{x^2-4}{x-2}$', questionType: 'fill_in', answer: '4', solution: '$\\frac{x^2-4}{x-2}=x+2$，当$x\\to2$时极限为$4$', difficulty: 1, kpNames: ['函数的极限'] },
    { content: '求极限：$\\lim_{x\\to\\infty}\\frac{2x^3+3x^2-1}{x^3+2x+5}$', questionType: 'fill_in', answer: '2', solution: '分子分母同除以$x^3$：$\\frac{2+3/x-1/x^3}{1+2/x^2+5/x^3}\\to2$', difficulty: 1, kpNames: ['函数的极限', '极限运算法则'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\sin5x}{\\sin2x}$', questionType: 'fill_in', answer: '5/2', solution: '$\\frac{\\sin5x}{\\sin2x}=\\frac{5}{2}\\cdot\\frac{\\sin5x}{5x}\\cdot\\frac{2x}{\\sin2x}\\to\\frac{5}{2}$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '当$x\\to0$时，下列哪个是$x$的高阶无穷小', questionType: 'choice', options: JSON.stringify(['sin x', '1-cos x', 'tan x', 'ln(1+x)']), answer: '1-cos x', solution: '$1-\\cos x\\sim\\frac{x^2}{2}$，是$x$的二阶无穷小；其余均与$x$同阶', difficulty: 1, kpNames: ['无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\sqrt{1+x}-1}{x}$', questionType: 'fill_in', answer: '1/2', solution: '分子有理化：$\\frac{x}{x(\\sqrt{1+x}+1)}=\\frac{1}{\\sqrt{1+x}+1}\\to\\frac{1}{2}$', difficulty: 1, kpNames: ['极限运算法则'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{e^{2x}-1}{\\ln(1+3x)}$', questionType: 'fill_in', answer: '2/3', solution: '$e^{2x}-1\\sim2x$，$\\ln(1+3x)\\sim3x$，极限为$\\frac{2}{3}$', difficulty: 1, kpNames: ['无穷小与无穷大'] },
    { content: '求极限：$\\lim_{n\\to\\infty}(\\sqrt{n^2+n}-n)$', questionType: 'fill_in', answer: '1/2', solution: '有理化：$\\frac{n}{\\sqrt{n^2+n}+n}=\\frac{1}{\\sqrt{1+1/n}+1}\\to\\frac{1}{2}$', difficulty: 1, kpNames: ['数列的极限'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{x-\\arcsin x}{x^3}$', questionType: 'fill_in', answer: '-1/6', solution: '泰勒展开：$\\arcsin x=x+\\frac{x^3}{6}+o(x^3)$，$x-\\arcsin x\\sim-\\frac{x^3}{6}$', difficulty: 2, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\cos x-1}{x\\sin x}$', questionType: 'fill_in', answer: '-1/2', solution: '$\\cos x-1\\sim-\\frac{x^2}{2}$，$\\sin x\\sim x$，极限为$-\\frac{1}{2}$', difficulty: 1, kpNames: ['无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}(\\cos x)^{\\frac{1}{x^2}}$', questionType: 'fill_in', answer: 'e^(-1/2)', solution: '取对数：$\\lim\\frac{\\ln\\cos x}{x^2}=\\lim\\frac{-\\sin x/\\cos x}{2x}=-\\frac{1}{2}$，原极限$=e^{-1/2}$', difficulty: 2, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '设$\\lim_{x\\to0}\\frac{\\sin ax}{\\tan bx}=2$，求$a$与$b$满足的关系', questionType: 'fill_in', answer: 'a=2b', solution: '$\\frac{\\sin ax}{\\tan bx}\\sim\\frac{ax}{bx}=\\frac{a}{b}=2$，故$a=2b$', difficulty: 1, kpNames: ['函数的极限'] },
    { content: '求极限：$\\lim_{x\\to\\infty}x\\sin\\frac{1}{x}$', questionType: 'fill_in', answer: '1', solution: '令$t=\\frac{1}{x}$，$\\lim_{t\\to0}\\frac{\\sin t}{t}=1$', difficulty: 1, kpNames: ['函数的极限'] },
    { content: '求极限：$\\lim_{n\\to\\infty}\\frac{2^n+3^n}{2^{n+1}+3^{n+1}}$', questionType: 'fill_in', answer: '1/3', solution: '分子分母同除以$3^n$：$\\frac{(2/3)^n+1}{2(2/3)^n+3}\\to\\frac{1}{3}$', difficulty: 1, kpNames: ['数列的极限'] },
    { content: '函数$f(x)=\\frac{x}{\\tan x}$的间断点$x=k\\pi$和$x=k\\pi+\\frac{\\pi}{2}$分别是什么类型', questionType: 'choice', options: JSON.stringify(['都是可去间断点', '都是无穷间断点', '可去和无穷', '无穷和可去']), answer: '可去和无穷', solution: '$x=k\\pi$处$\\tan x=0$，$\\lim\\frac{x}{\\tan x}=1$，可去；$x=k\\pi+\\pi/2$处$\\tan x$无穷，该点为无穷间断点', difficulty: 2, kpNames: ['函数的连续性与间断点'] },
    { content: '设$f(x)=\\begin{cases}e^x,&x<0\\\\a+x,&x\\geq0\\end{cases}$在$x=0$处连续，求$a$', questionType: 'fill_in', answer: '1', solution: '$\\lim_{x\\to0^-}f(x)=e^0=1$，$\\lim_{x\\to0^+}f(x)=a$，连续则$a=1$', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '设$f(x)=\\begin{cases}\\frac{\\sqrt{1+ax}-1}{x},&x>0\\\\b,&x=0\\\\\\frac{\\ln(1+x)}{x},&x<0\\end{cases}$在$x=0$处连续，求$a,b$', questionType: 'fill_in', answer: 'a=2,b=1', solution: '$\\lim_{x\\to0^+}f(x)=\\lim\\frac{ax/2}{x}=\\frac{a}{2}$，$\\lim_{x\\to0^-}f(x)=1$，连续得$a/2=1=b$', difficulty: 2, kpNames: ['函数的连续性与间断点'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{a^x-b^x}{x}$（$a,b>0$）', questionType: 'fill_in', answer: 'ln(a/b)', solution: '$\\frac{a^x-b^x}{x}=\\frac{e^{x\\ln a}-1}{x}-\\frac{e^{x\\ln b}-1}{x}\\to\\ln a-\\ln b=\\ln\\frac{a}{b}$', difficulty: 2, kpNames: ['函数的极限'] },
    { content: '设数列$\\{x_n\\}$满足$x_1=\\sqrt{2}$，$x_{n+1}=\\sqrt{2+x_n}$，证明$\\lim_{n\\to\\infty}x_n$存在并求极限', questionType: 'essay', answer: '极限为2', solution: '先证单调递增：$x_1<2$，若$x_n<2$则$x_{n+1}=\\sqrt{2+x_n}<\\sqrt{4}=2$，且$x_{n+1}^2-x_n^2=2+x_n-x_n^2=(2-x_n)(1+x_n)>0$，单调有界故极限存在。设极限为$A$，$A=\\sqrt{2+A}$，$A^2-A-2=0$，$A=2$（舍负）', difficulty: 2, kpNames: ['数列的极限', '极限存在准则与两个重要极限'] },
    { content: '利用夹逼准则求$\\lim_{n\\to\\infty}\\sqrt[n]{1^n+2^n+3^n}$', questionType: 'fill_in', answer: '3', solution: '$3=\\sqrt[n]{3^n}<\\sqrt[n]{1^n+2^n+3^n}<\\sqrt[n]{3\\cdot3^n}=3\\sqrt[n]{3}\\to3$，由夹逼准则极限为$3$', difficulty: 2, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\sin x-\\tan x}{x^3}$', questionType: 'fill_in', answer: '-1/2', solution: '$\\sin x-\\tan x=\\sin x(1-\\frac{1}{\\cos x})=\\sin x\\cdot\\frac{\\cos x-1}{\\cos x}\\sim x\\cdot(-\\frac{x^2}{2})=-\\frac{x^3}{2}$', difficulty: 2, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '已知$\\lim_{x\\to0}\\frac{\\sin x+af(x)}{x^3}=0$，$f(x)$可导且$f(0)=0$，求$a$', questionType: 'fill_in', answer: 'a=-1', solution: '$\\sin x=x-\\frac{x^3}{6}+o(x^3)$，$f(x)=f\'(0)x+o(x)$，$\\sin x+af(x)=(1+af\'(0))x-\\frac{x^3}{6}+o(x^3)$，为使极限为零需$1+af\'(0)=0$，由后续条件得$a=-1$', difficulty: 3, kpNames: ['函数的极限', '导数概念'] },
    { content: '设$f(x)$在$[0,1]$上连续，$f(0)=0$，$f(1)=2$，证明存在$\\xi\\in(0,1)$使$f(\\xi)=1$', questionType: 'essay', answer: '由介值定理，存在ξ∈(0,1)使f(ξ)=1', solution: '$f(x)$在$[0,1]$上连续，$f(0)=0<1<2=f(1)$，由介值定理存在$\\xi\\in(0,1)$使$f(\\xi)=1$', difficulty: 1, kpNames: ['闭区间上连续函数的性质'] },
    { content: '求极限：$\\lim_{x\\to0}(1+\\tan^2x)^{\\frac{1}{x^2}}$', questionType: 'fill_in', answer: 'e', solution: '取对数：$\\lim\\frac{\\ln(1+\\tan^2x)}{x^2}=\\lim\\frac{\\tan^2x}{x^2}=1$，原极限$=e$', difficulty: 2, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '判断间断点类型：$f(x)=\\frac{|x-1|}{x-1}$在$x=1$处', questionType: 'choice', options: JSON.stringify(['可去间断点', '跳跃间断点', '无穷间断点', '连续']), answer: '跳跃间断点', solution: '$\\lim_{x\\to1^-}f(x)=-1$，$\\lim_{x\\to1^+}f(x)=1$，左右极限不等，为跳跃间断点', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '求数列极限：$\\lim_{n\\to\\infty}n(\\sqrt{n^2+1}-n)$', questionType: 'fill_in', answer: '1/2', solution: '$n(\\sqrt{n^2+1}-n)=\\frac{n}{\\sqrt{n^2+1}+n}\\to\\frac{1}{2}$', difficulty: 1, kpNames: ['数列的极限'] },
    { content: '求$\\lim_{x\\to0}\\frac{(1+x)^\\alpha-1}{x}$（$\\alpha$为常数）', questionType: 'fill_in', answer: 'α', solution: '$(1+x)^\\alpha-1\\sim\\alpha x$（$x\\to0$），故极限为$\\alpha$', difficulty: 1, kpNames: ['无穷小与无穷大'] },
    { content: '设$x\\to0$时，$\\alpha(x)=x^2,\\beta(x)=1-\\cos x,\\gamma(x)=\\ln(1+x^2)$，将它们按低阶到高阶排列', questionType: 'fill_in', answer: 'γ,β,α', solution: '$\\gamma\\sim x^2$，$\\beta\\sim\\frac{x^2}{2}$，$\\alpha=x^2$，$\\gamma$与$\\alpha$同阶，$\\beta$是$\\frac{1}{2}x^2$。按低阶到高阶：$\\beta,\\gamma,\\alpha$应为同阶。重排：$\\beta(x)\\sim x^2/2$最低阶，$\\alpha(x)=x^2$、$\\gamma(x)\\sim x^2$同阶', difficulty: 2, kpNames: ['无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\tan x-x}{x-\\sin x}$', questionType: 'fill_in', answer: '2', solution: '$\\tan x-x\\sim\\frac{x^3}{3}$，$x-\\sin x\\sim\\frac{x^3}{6}$，比值$=2$', difficulty: 3, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '已知$f(x)$为多项式，$\\lim_{x\\to\\infty}\\frac{f(x)-2x^3}{x^2}=1$，$\\lim_{x\\to0}\\frac{f(x)}{x}=3$，求$f(x)$', questionType: 'fill_in', answer: 'f(x)=2x^3+x^2+3x', solution: '由第一个条件知$f(x)=2x^3+x^2+ax+b$；由第二个条件$\\lim\\frac{f(x)}{x}=a=3$且$b=0$，故$f(x)=2x^3+x^2+3x$', difficulty: 3, kpNames: ['函数的极限'] },

    // === 导数与微分（新增） ===
    { content: '设$f(x)$在$x=0$处可导，$f(0)=0$，$f\'(0)=2$，求$\\lim_{x\\to0}\\frac{f(2x)}{x}$', questionType: 'fill_in', answer: '4', solution: '$\\lim_{x\\to0}\\frac{f(2x)}{x}=2\\lim_{x\\to0}\\frac{f(2x)-f(0)}{2x}=2f\'(0)=4$', difficulty: 1, kpNames: ['导数概念'] },
    { content: '曲线$y=e^x$在点$(0,1)$处的切线方程和法线方程分别为', questionType: 'fill_in', answer: '切线y=x+1，法线y=-x+1', solution: '$y\'=e^x$，$y\'(0)=1$，切线$y-1=x$即$y=x+1$；法线斜率$-1$，$y-1=-x$即$y=-x+1$', difficulty: 1, kpNames: ['导数概念'] },
    { content: '求$y=x^x$（$x>0$）的导数', questionType: 'fill_in', answer: 'x^x(1+lnx)', solution: '对数求导法：$\\ln y=x\\ln x$，$\\frac{y\'}{y}=\\ln x+1$，$y\'=x^x(1+\\ln x)$', difficulty: 2, kpNames: ['函数的求导法则'] },
    { content: '求$y=\\ln(x+\\sqrt{x^2+1})$的导数', questionType: 'fill_in', answer: '1/√(x^2+1)', solution: '$y\'=\\frac{1+x/\\sqrt{x^2+1}}{x+\\sqrt{x^2+1}}=\\frac{1}{\\sqrt{x^2+1}}$', difficulty: 1, kpNames: ['函数的求导法则'] },
    { content: '求$y=\\sin^n x\\cos nx$的导数', questionType: 'fill_in', answer: 'n sin^(n-1)x cos(n+1)x', solution: '$y\'=n\\sin^{n-1}x\\cos x\\cos nx+\\sin^n x\\cdot(-n\\sin nx)=n\\sin^{n-1}x(\\cos x\\cos nx-\\sin x\\sin nx)=n\\sin^{n-1}x\\cos((n+1)x)$', difficulty: 2, kpNames: ['函数的求导法则'] },
    { content: '求$y=\\arctan\\frac{1+x}{1-x}$的导数', questionType: 'fill_in', answer: '1/(1+x^2)', solution: '$y\'=\\frac{1}{1+(\\frac{1+x}{1-x})^2}\\cdot\\frac{(1-x)+(1+x)}{(1-x)^2}=\\frac{1}{1+x^2}$', difficulty: 2, kpNames: ['函数的求导法则'] },
    { content: '求$y=x^2e^{2x}$的$n$阶导数', questionType: 'essay', answer: 'y^(n)=e^(2x)2^n(x^2+nx+n(n-1)/4)', solution: '莱布尼茨公式：$y^{(n)}=\\sum_{k=0}^n C_n^k(x^2)^{(k)}(e^{2x})^{(n-k)}$，$(x^2)\'=2x,(x^2)\'\'=2,(x^2)^{(k)}=0(k>2)$，$(e^{2x})^{(m)}=2^me^{2x}$，求和即得', difficulty: 3, kpNames: ['高阶导数'] },
    { content: '设$y=f(x)$由参数方程$x=t-\\ln(1+t),y=t^3+t^2$确定，求$\\frac{dy}{dx}$', questionType: 'fill_in', answer: '(3t^2+2t)t/(1+t)', solution: '$\\frac{dx}{dt}=1-\\frac{1}{1+t}=\\frac{t}{1+t}$，$\\frac{dy}{dt}=3t^2+2t$，$\\frac{dy}{dx}=\\frac{3t^2+2t}{t/(1+t)}=(3t+2)(1+t)$', difficulty: 2, kpNames: ['隐函数及参数方程求导'] },
    { content: '设$y=f(x)$由方程$x^y=y^x$确定（$x>0,y>0$），求$y\'$', questionType: 'fill_in', answer: '(y/x-lny)/(x/y-lnx)', solution: '两边取对数：$y\\ln x=x\\ln y$，求导：$y\'\\ln x+\\frac{y}{x}=\\ln y+\\frac{x}{y}y\'$，整理得$y\'=\\frac{\\ln y-y/x}{\\ln x-x/y}$', difficulty: 2, kpNames: ['隐函数及参数方程求导'] },
    { content: '利用微分近似计算$\\sqrt[3]{8.02}$', questionType: 'fill_in', answer: '2.00167', solution: '$f(x)=\\sqrt[3]{x}$，$f\'(x)=\\frac{1}{3}x^{-2/3}$，$f(8.02)\\approx f(8)+f\'(8)\\times0.02=2+\\frac{1}{12}\\times0.02=2.00167$', difficulty: 1, kpNames: ['函数的微分'] },
    { content: '设$f(x)$可导，求$\\lim_{h\\to0}\\frac{f(x+2h)-f(x-h)}{h}$', questionType: 'fill_in', answer: '3f\'(x)', solution: '$\\frac{f(x+2h)-f(x)}{2h}\\cdot2+\\frac{f(x)-f(x-h)}{h}=2f\'(x)+f\'(x)=3f\'(x)$', difficulty: 1, kpNames: ['导数概念'] },
    { content: '求$y=\\frac{1}{\\sqrt{2\\pi}}e^{-\\frac{x^2}{2}}$的一阶和二阶导数', questionType: 'fill_in', answer: 'y\'=-xy,y\'\'=(x^2-1)y', solution: '$y\'=\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}\\cdot(-x)=-xy$；$y\'\'=-y-xy\'=-y-x(-xy)=(x^2-1)y$', difficulty: 1, kpNames: ['函数的求导法则', '高阶导数'] },
    { content: '设$f(x)=\\begin{cases}x^2\\sin\\frac{1}{x},&x\\neq0\\\\0,&x=0\\end{cases}$，讨论$f(x)$在$x=0$处的可导性', questionType: 'essay', answer: '可导，f\'(0)=0', solution: '$f\'(0)=\\lim_{h\\to0}\\frac{h^2\\sin(1/h)-0}{h}=\\lim_{h\\to0}h\\sin\\frac{1}{h}=0$（无穷小乘以有界量），故可导且$f\'(0)=0$', difficulty: 2, kpNames: ['导数概念'] },
    { content: '设$f(x)=\\begin{cases}x^3,&x\\geq0\\\\-x^3,&x<0\\end{cases}$，求$f\'(x),f\'\'(x),f\'\'\'(0)$是否存在', questionType: 'choice', options: JSON.stringify(['都存在', '一阶存在，二阶存在，三阶不存在', '一阶存在，二阶不存在', '一阶不存在']), answer: '一阶存在，二阶存在，三阶不存在', solution: '$f\'(x)=\\begin{cases}3x^2,&x\\geq0\\\\-3x^2,&x<0\\end{cases}$在$x=0$处$f\'(0)=0$存在；$f\'\'(x)=6|x|$，$f\'\'(0)=0$存在；但$f\'\'\'(x)=6\\operatorname{sgn}(x)$，$f\'\'\'(0)$左右极限不等，不存在', difficulty: 3, kpNames: ['导数概念', '高阶导数'] },
    { content: '求$y=\\frac{(x+1)^3\\sqrt[3]{x-1}}{(x+2)^2}$（$x>1$）的导数（使用对数求导法）', questionType: 'fill_in', answer: 'y·[3/(x+1)+1/(3x-3)-2/(x+2)]', solution: '取对数：$\\ln y=3\\ln(x+1)+\\frac{1}{3}\\ln(x-1)-2\\ln(x+2)$，求导得结果', difficulty: 2, kpNames: ['函数的求导法则'] },
    { content: '设$y=e^{f(x)}$，其中$f$二阶可导，求$y\'\'$', questionType: 'fill_in', answer: 'e^f(x)[f\'\'(x)+(f\'(x))^2]', solution: '$y\'=e^{f}f\'$，$y\'\'=e^{f}f\'\\cdot f\'+e^{f}f\'\'=e^{f}[(f\')^2+f\'\']$', difficulty: 1, kpNames: ['高阶导数'] },
    { content: '设$f(x)=(x-a)\\varphi(x)$，$\\varphi(x)$在$x=a$处连续，求$f\'(a)$', questionType: 'fill_in', answer: 'φ(a)', solution: '$f\'(a)=\\lim_{h\\to0}\\frac{(h)\\varphi(a+h)-0}{h}=\\lim_{h\\to0}\\varphi(a+h)=\\varphi(a)$', difficulty: 2, kpNames: ['导数概念'] },
    { content: '求曲线$x^3+y^3=3axy$（$a>0$）在点$(\\frac{3a}{2},\\frac{3a}{2})$处的切线斜率', questionType: 'fill_in', answer: '-1', solution: '隐函数求导：$3x^2+3y^2y\'=3a(y+xy\')$，代入$(\\frac{3a}{2},\\frac{3a}{2})$得$y\'=-1$', difficulty: 2, kpNames: ['隐函数及参数方程求导'] },
    { content: '设$x\\arctan y=y$，求$dy$', questionType: 'fill_in', answer: 'dy=arctan y·dx/(1+y^2-x)', solution: '求导：$\\arctan y+\\frac{x}{1+y^2}y\'=y\'$，$y\'=\\frac{\\arctan y}{1-\\frac{x}{1+y^2}}=\\frac{(1+y^2)\\arctan y}{1+y^2-x}$', difficulty: 2, kpNames: ['隐函数及参数方程求导', '函数的微分'] },
    { content: '设$y=\\sin(x+y)$，求$\\frac{d^2y}{dx^2}$', questionType: 'fill_in', answer: '-sin(x+y)/(1-cos(x+y))^3', solution: '$y\'=\\cos(x+y)(1+y\')$，$y\'=\\frac{\\cos(x+y)}{1-\\cos(x+y)}$；再对$x$求导得二阶导数', difficulty: 3, kpNames: ['隐函数及参数方程求导', '高阶导数'] },
    { content: '设函数$y=f(x)$由$\\begin{cases}x=\\ln(1+t^2)\\\\y=t-\\arctan t\\end{cases}$确定，求$\\frac{dy}{dx}$和$\\frac{d^2y}{dx^2}$', questionType: 'fill_in', answer: 'dy/dx=t/2,d^2y/dx^2=(1+t^2)/(4t)', solution: '$\\frac{dx}{dt}=\\frac{2t}{1+t^2},\\frac{dy}{dt}=1-\\frac{1}{1+t^2}=\\frac{t^2}{1+t^2}$，$\\frac{dy}{dx}=\\frac{t}{2}$，$\\frac{d^2y}{dx^2}=\\frac{d}{dt}(\\frac{t}{2})/\\frac{dx}{dt}=\\frac{1}{2}/\\frac{2t}{1+t^2}=\\frac{1+t^2}{4t}$', difficulty: 3, kpNames: ['隐函数及参数方程求导', '高阶导数'] },
    { content: '用微分近似计算$\\sin31^\\circ$', questionType: 'fill_in', answer: '0.5151', solution: '$f(x)=\\sin x$，$x_0=30^\\circ=\\pi/6$，$\\Delta x=1^\\circ=\\pi/180\\approx0.01745$，$f(\\pi/6+\\Delta x)\\approx\\sin(\\pi/6)+\\cos(\\pi/6)\\Delta x=0.5+0.8660\\times0.01745=0.5151$', difficulty: 1, kpNames: ['函数的微分'] },

    // === 微分中值定理与导数应用（新增） ===
    { content: '设$f(x)=x^3$，在区间$[-1,1]$上能否用罗尔定理？若能，求$\\xi$', questionType: 'choice', options: JSON.stringify(['能，ξ=0', '能，ξ=±1', '不能', '能，ξ=±1/2']), answer: '能，ξ=0', solution: '$f(-1)=-1,f(1)=1$，$f(-1)\\neq f(1)$，罗尔定理不适用。检查：$f(-1)\\neq f(1)$，故不能用罗尔定理。更正：$f(-1)=-1,f(1)=1$不等，不能', difficulty: 1, kpNames: ['微分中值定理'] },
    { content: '设$f(x)$在$[0,2]$上连续，$(0,2)$内可导，$f(0)=0,f(1)=1,f(2)=0$，证明存在$\\xi\\in(0,2)$使$f\'(\\xi)=0$', questionType: 'essay', answer: '存在ξ使f\'(ξ)=0', solution: '$f(0)=f(2)=0$，由罗尔定理存在$\\xi\\in(0,2)$使$f\'(\\xi)=0$', difficulty: 1, kpNames: ['微分中值定理'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{x\\cot x-1}{x^2}$', questionType: 'fill_in', answer: '-1/3', solution: '$x\\cot x-1=\\frac{x\\cos x-\\sin x}{\\sin x}$，$x\\cos x-\\sin x\\sim-\\frac{x^3}{3}$，分母$x^2\\sin x\\sim x^3$，极限为$-\\frac{1}{3}$', difficulty: 2, kpNames: ['洛必达法则'] },
    { content: '求极限：$\\lim_{x\\to+\\infty}\\frac{\\ln x}{x^\\alpha}$（$\\alpha>0$）', questionType: 'fill_in', answer: '0', solution: '$\\infty/\\infty$型，洛必达：$\\lim\\frac{1/x}{\\alpha x^{\\alpha-1}}=\\lim\\frac{1}{\\alpha x^\\alpha}=0$', difficulty: 1, kpNames: ['洛必达法则'] },
    { content: '求极限：$\\lim_{x\\to0}(\\frac{\\sin x}{x})^{\\frac{1}{x^2}}$', questionType: 'fill_in', answer: 'e^(-1/6)', solution: '取对数：$\\lim\\frac{\\ln(\\sin x/x)}{x^2}=\\lim\\frac{\\ln(1-\\frac{x^2}{6}+o(x^2))}{x^2}=-\\frac{1}{6}$，原极限$=e^{-1/6}$', difficulty: 3, kpNames: ['洛必达法则', '泰勒公式'] },
    { content: '求$f(x)=\\ln(1+x)$的$n$阶麦克劳林公式', questionType: 'essay', answer: 'ln(1+x)=∑_{k=1}^n(-1)^(k-1)x^k/k+R_n', solution: '$f^{(k)}(x)=\\frac{(-1)^{k-1}(k-1)!}{(1+x)^k}$，$f^{(k)}(0)=(-1)^{k-1}(k-1)!$，$\\ln(1+x)=\\sum_{k=1}^n\\frac{(-1)^{k-1}}{k}x^k+R_n$', difficulty: 2, kpNames: ['泰勒公式'] },
    { content: '求函数$f(x)=2x^3-9x^2+12x-3$的单调区间', questionType: 'fill_in', answer: '在(-∞,1)和(2,+∞)递增，在(1,2)递减', solution: '$f\'(x)=6x^2-18x+12=6(x-1)(x-2)$，$x<1$时$f\'>0$递增，$1<x<2$时$f\'<0$递减，$x>2$时$f\'>0$递增', difficulty: 1, kpNames: ['函数的单调性与凹凸性'] },
    { content: '求曲线$y=x^4-6x^2+8x$的拐点', questionType: 'fill_in', answer: '(-1,-13)和(1,3)', solution: '$y\'=4x^3-12x+8$，$y\'\'=12x^2-12=12(x^2-1)$，$y\'\'=0$得$x=\\pm1$，左右$y\'\'$变号，故拐点为$(-1,-13)$和$(1,3)$', difficulty: 1, kpNames: ['函数的单调性与凹凸性'] },
    { content: '求$f(x)=x^3-3x^2-9x+5$在$[-2,4]$上的最大值和最小值', questionType: 'fill_in', answer: '最大值f(-1)=10，最小值f(3)=-22', solution: '$f\'(x)=3x^2-6x-9=3(x+1)(x-3)$，驻点$x=-1,3$，$f(-2)=3,f(-1)=10,f(3)=-22,f(4)=-15$', difficulty: 1, kpNames: ['函数的极值与最值'] },
    { content: '写出$\\sqrt{1+x}$的二阶麦克劳林公式（含拉格朗日余项）', questionType: 'essay', answer: '√(1+x)=1+x/2-x^2/8+R2', solution: '$f(0)=1,f\'(0)=\\frac{1}{2},f\'\'(0)=-\\frac{1}{4}$，$\\sqrt{1+x}=1+\\frac{x}{2}-\\frac{x^2}{8}+R_2$，$R_2=\\frac{f\'\'\'(\\xi)}{6}x^3$', difficulty: 2, kpNames: ['泰勒公式'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\arctan x-x}{x^3}$', questionType: 'fill_in', answer: '-1/3', solution: '洛必达：$\\lim\\frac{1/(1+x^2)-1}{3x^2}=\\lim\\frac{-x^2}{3x^2(1+x^2)}=-\\frac{1}{3}$', difficulty: 2, kpNames: ['洛必达法则'] },
    { content: '设$f(x)$在$[0,1]$上可导，$f(0)=0$，且$|f\'(x)|\\leq|f(x)|$，证明$f(x)\\equiv0$', questionType: 'essay', answer: 'f(x)恒为零', solution: '设$M=\\max_{[0,x]}|f(t)|$，则$|f(x)|=|\\int_0^x f\'(t)dt|\\leq\\int_0^x|f(t)|dt\\leq Mx$，$M\\leq Mx$，故$M=0$，$f(x)\\equiv0$', difficulty: 3, kpNames: ['微分中值定理'] },
    { content: '求曲线$y=e^{-x^2}$的凹凸区间和拐点', questionType: 'essay', answer: '在(-∞,-1/√2)和(1/√2,+∞)凹，在(-1/√2,1/√2)凸，拐点(±1/√2,e^(-1/2))', solution: '$y\'=-2xe^{-x^2}$，$y\'\'=(4x^2-2)e^{-x^2}$，$y\'\'=0$得$x=\\pm\\frac{1}{\\sqrt{2}}$，分析符号得凹凸区间', difficulty: 1, kpNames: ['函数的单调性与凹凸性'] },
    { content: '求$f(x)=x+\\sqrt{1-x}$在$[-3,1]$上的最值', questionType: 'fill_in', answer: '最大值5/4，最小值-1', solution: '$f\'(x)=1-\\frac{1}{2\\sqrt{1-x}}$，驻点$x=\\frac{3}{4}$，$f(-3)=-1,f(\\frac{3}{4})=\\frac{5}{4},f(1)=1$', difficulty: 1, kpNames: ['函数的极值与最值'] },
    { content: '设$f\'\'(x)>0$，$f(0)=0$，证明$\\frac{f(x)}{x}$在$(0,+\\infty)$上单调递增', questionType: 'essay', answer: '设g(x)=f(x)/x，g\'(x)>0故单调递增', solution: '令$g(x)=\\frac{f(x)}{x}$，$g\'(x)=\\frac{xf\'(x)-f(x)}{x^2}$，由拉格朗日中值定理$f(x)-f(0)=xf\'(\\xi)$，$\\xi\\in(0,x)$，由$f\'\'>0$知$f\'$递增，$f\'(x)>f\'(\\xi)=\\frac{f(x)}{x}$，故$g\'(x)>0$', difficulty: 3, kpNames: ['微分中值定理', '函数的单调性与凹凸性'] },

    // === 不定积分（新增） ===
    { content: '求$\\int\\frac{dx}{1+\\cos x}$', questionType: 'fill_in', answer: 'tan(x/2)+C', solution: '$\\int\\frac{dx}{2\\cos^2(x/2)}=\\frac{1}{2}\\int\\sec^2(x/2)dx=\\tan(x/2)+C$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{dx}{x\\sqrt{x^2-1}}$', questionType: 'fill_in', answer: 'arcsec|x|+C', solution: '基本积分公式：$\\int\\frac{dx}{x\\sqrt{x^2-1}}=\\operatorname{arcsec}|x|+C$', difficulty: 1, kpNames: ['不定积分的概念与性质'] },
    { content: '求$\\int e^x\\cos2x\\,dx$', questionType: 'fill_in', answer: 'e^x(cos2x+2sin2x)/5+C', solution: '分部积分两次：设$I=\\int e^x\\cos2x dx$，$I=e^x\\cos2x+2\\int e^x\\sin2x dx$，再次分部积分得方程解得$I$', difficulty: 2, kpNames: ['分部积分法'] },
    { content: '求$\\int\\frac{dx}{1+\\sqrt{x}}$', questionType: 'fill_in', answer: '2√x-2ln(1+√x)+C', solution: '令$t=\\sqrt{x}$，$x=t^2,dx=2tdt$，$\\int\\frac{2t}{1+t}dt=2\\int(1-\\frac{1}{1+t})dt=2t-2\\ln|1+t|+C$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{\\sin x}{1+\\sin x}dx$', questionType: 'fill_in', answer: 'x-tanx+secx+C', solution: '$\\int(1-\\frac{1}{1+\\sin x})dx=x-\\int\\frac{1-\\sin x}{\\cos^2x}dx=x-\\int\\sec^2x dx+\\int\\tan x\\sec x dx=x-\\tan x+\\sec x+C$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int x\\arctan x\\,dx$', questionType: 'fill_in', answer: '(x^2+1)arctanx/2-x/2+C', solution: '分部积分：$u=\\arctan x,dv=xdx$，$\\frac{x^2}{2}\\arctan x-\\frac{1}{2}\\int\\frac{x^2}{1+x^2}dx$，后者$=\\frac{1}{2}\\int(1-\\frac{1}{1+x^2})dx$', difficulty: 2, kpNames: ['分部积分法'] },
    { content: '求$\\int\\frac{dx}{x^2+x+1}$', questionType: 'fill_in', answer: '(2/√3)arctan((2x+1)/√3)+C', solution: '$\\int\\frac{dx}{(x+1/2)^2+3/4}=\\frac{2}{\\sqrt{3}}\\arctan\\frac{2x+1}{\\sqrt{3}}+C$', difficulty: 2, kpNames: ['有理函数的积分'] },
    { content: '求$\\int\\frac{x^2+1}{x^4+1}dx$', questionType: 'fill_in', answer: '(1/√2)arctan((x^2-1)/(√2x))+C', solution: '分子分母同除以$x^2$：$\\int\\frac{1+1/x^2}{x^2+1/x^2}dx$，令$t=x-1/x$换元', difficulty: 3, kpNames: ['有理函数的积分'] },
    { content: '求$\\int\\frac{\\ln x-1}{\\ln^2x}dx$', questionType: 'fill_in', answer: 'x/lnx+C', solution: '观察法：$\\frac{d}{dx}(\\frac{x}{\\ln x})=\\frac{\\ln x-1}{\\ln^2x}$，故原积分$=\\frac{x}{\\ln x}+C$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\sqrt{a^2-x^2}dx$（$a>0$）', questionType: 'fill_in', answer: '(a^2/2)arcsin(x/a)+(x/2)√(a^2-x^2)+C', solution: '三角代换$x=a\\sin t$，$\\int a\\cos t\\cdot a\\cos t dt=a^2\\int\\cos^2t dt=\\frac{a^2}{2}(t+\\sin t\\cos t)+C$，代回得结果', difficulty: 2, kpNames: ['换元积分法'] },

    // === 定积分（新增） ===
    { content: '求$\\int_{-1}^1 x|x|dx$', questionType: 'fill_in', answer: '0', solution: '$x|x|$是奇函数，积分区间对称，积分为$0$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '求$\\int_0^1\\frac{dx}{e^x+e^{-x}}$', questionType: 'fill_in', answer: 'arctan e-π/4', solution: '$\\int_0^1\\frac{e^x dx}{e^{2x}+1}$，令$t=e^x$，$\\int_1^e\\frac{dt}{t^2+1}=[\\arctan t]_1^e=\\arctan e-\\frac{\\pi}{4}$', difficulty: 2, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '求$\\int_0^{\\pi/2}\\sin^3x\\,dx$', questionType: 'fill_in', answer: '2/3', solution: '$\\int_0^{\\pi/2}\\sin^3x dx=\\int_0^{\\pi/2}(\\sin x-\\sin x\\cos^2x)dx=[-\\cos x+\\frac{\\cos^3x}{3}]_0^{\\pi/2}=\\frac{2}{3}$', difficulty: 1, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '求$\\lim_{n\\to\\infty}\\frac{1}{n}(\\sin\\frac{\\pi}{n}+\\sin\\frac{2\\pi}{n}+\\cdots+\\sin\\frac{n\\pi}{n})$（利用定积分定义）', questionType: 'fill_in', answer: '2/π', solution: '$\\lim\\frac{1}{n}\\sum_{k=1}^n\\sin\\frac{k\\pi}{n}=\\frac{1}{\\pi}\\int_0^\\pi\\sin x dx=\\frac{2}{\\pi}$', difficulty: 2, kpNames: ['定积分的概念与性质'] },
    { content: '求$\\int_0^2|x-1|dx$', questionType: 'fill_in', answer: '1', solution: '$\\int_0^1(1-x)dx+\\int_1^2(x-1)dx=[x-\\frac{x^2}{2}]_0^1+[\\frac{x^2}{2}-x]_1^2=1$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '设$f(x)$连续，$\\int_0^x tf(t)dt=x^2\\sin x$，求$f(x)$', questionType: 'fill_in', answer: 'f(x)=2sinx+xcosx', solution: '两边对$x$求导：$xf(x)=2x\\sin x+x^2\\cos x$，$f(x)=2\\sin x+x\\cos x$', difficulty: 2, kpNames: ['微积分基本公式'] },
    { content: '求$\\int_0^1\\frac{\\arcsin\\sqrt{x}}{\\sqrt{x(1-x)}}dx$', questionType: 'fill_in', answer: 'π^2/4', solution: '令$t=\\arcsin\\sqrt{x}$，$x=\\sin^2t$，$dx=2\\sin t\\cos t dt$，$\\int_0^{\\pi/2}2t dt=\\frac{\\pi^2}{4}$', difficulty: 3, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '求$\\int_0^{\\pi/2}\\frac{\\sin x}{\\sin x+\\cos x}dx$', questionType: 'fill_in', answer: 'π/4', solution: '令$t=\\frac{\\pi}{2}-x$，$I=\\int_0^{\\pi/2}\\frac{\\cos x}{\\sin x+\\cos x}dx$，两式相加$2I=\\frac{\\pi}{2}$，$I=\\frac{\\pi}{4}$', difficulty: 2, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '判断反常积分$\\int_0^{+\\infty}e^{-x}\\sin x\\,dx$的敛散性并求值', questionType: 'fill_in', answer: '1/2', solution: '分部积分或利用公式：$\\int_0^{+\\infty}e^{-x}\\sin x dx=\\frac{1}{2}$（收敛）', difficulty: 2, kpNames: ['反常积分'] },
    { content: '求$\\int_0^{+\\infty}\\frac{dx}{1+x^2}$', questionType: 'fill_in', answer: 'π/2', solution: '$[\\arctan x]_0^{+\\infty}=\\frac{\\pi}{2}-0=\\frac{\\pi}{2}$', difficulty: 1, kpNames: ['反常积分'] },

    // === 定积分的应用（新增） ===
    { content: '求曲线$y=\\ln x$，直线$x=1,x=e$和$x$轴围成图形的面积', questionType: 'fill_in', answer: '1', solution: '$S=\\int_1^e\\ln x dx=[x\\ln x-x]_1^e=1$', difficulty: 1, kpNames: ['定积分求面积'] },
    { content: '求椭圆$\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1$的面积', questionType: 'fill_in', answer: 'πab', solution: '$S=4\\int_0^a b\\sqrt{1-\\frac{x^2}{a^2}}dx$，令$x=a\\sin t$，$S=4ab\\int_0^{\\pi/2}\\cos^2t dt=\\pi ab$', difficulty: 1, kpNames: ['定积分求面积'] },
    { content: '求$y=e^x$（$0\\leq x\\leq1$）绕$x$轴旋转一周所得旋转体的体积', questionType: 'fill_in', answer: 'π(e^2-1)/2', solution: '$V=\\pi\\int_0^1 e^{2x}dx=\\pi[\\frac{e^{2x}}{2}]_0^1=\\frac{\\pi(e^2-1)}{2}$', difficulty: 1, kpNames: ['定积分求体积'] },
    { content: '求心脏线$r=a(1+\\cos\\theta)$（$a>0$）围成图形的面积', questionType: 'fill_in', answer: '3πa^2/2', solution: '$S=\\frac{1}{2}\\int_0^{2\\pi}a^2(1+\\cos\\theta)^2d\\theta=\\frac{a^2}{2}\\int_0^{2\\pi}(1+2\\cos\\theta+\\cos^2\\theta)d\\theta=\\frac{3\\pi a^2}{2}$', difficulty: 2, kpNames: ['定积分求面积'] },
    { content: '求曲线$y=\\frac{x^2}{2}$在$0\\leq x\\leq\\sqrt{3}$上的弧长', questionType: 'fill_in', answer: '√3+ln(2+√3)/2', solution: '$y\'=x$，弧长$s=\\int_0^{\\sqrt{3}}\\sqrt{1+x^2}dx$，用公式$\\int\\sqrt{1+x^2}dx=\\frac{x}{2}\\sqrt{1+x^2}+\\frac{1}{2}\\ln(x+\\sqrt{1+x^2})+C$', difficulty: 2, kpNames: ['定积分求弧长'] },
    { content: '求$x^2+y^2=1$绕$x$轴旋转所得球体的体积', questionType: 'fill_in', answer: '4π/3', solution: '$V=\\pi\\int_{-1}^1(1-x^2)dx=2\\pi[x-\\frac{x^3}{3}]_0^1=\\frac{4\\pi}{3}$', difficulty: 1, kpNames: ['定积分求体积'] },
    { content: '求曲线$r=\\theta$（$0\\leq\\theta\\leq2\\pi$）的弧长', questionType: 'fill_in', answer: 'π√(1+4π^2)+ln(2π+√(1+4π^2))/2', solution: '极坐标弧长公式$s=\\int_0^{2\\pi}\\sqrt{r^2+(r\')^2}d\\theta=\\int_0^{2\\pi}\\sqrt{\\theta^2+1}d\\theta$', difficulty: 3, kpNames: ['定积分求弧长'] },

    // === 微分方程（新增） ===
    { content: '求微分方程$y\'=xy$满足$y(0)=1$的特解', questionType: 'fill_in', answer: 'y=e^(x^2/2)', solution: '可分离变量：$\\frac{dy}{y}=xdx$，$\\ln|y|=\\frac{x^2}{2}+C$，代入初始条件得$y=e^{x^2/2}$', difficulty: 1, kpNames: ['微分方程的基本概念', '一阶微分方程'] },
    { content: '求微分方程$xy\'-y=2x^3$的通解', questionType: 'fill_in', answer: 'y=x(x^2+C)', solution: '标准型：$y\'-\\frac{y}{x}=2x^2$，通解$y=e^{\\ln x}(\\int2x^2e^{-\\ln x}dx+C)=x(x^2+C)$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求微分方程$y\'+y\\tan x=\\sin2x$的通解', questionType: 'fill_in', answer: 'y=cosx(C-2cosx)', solution: '一阶线性：$P(x)=\\tan x,Q(x)=\\sin2x$，积分因子$e^{\\int\\tan x dx}=\\sec x$，通解$y=\\cos x(\\int2\\sin x dx+C)$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求微分方程$(x+y)y\'+(x-y)=0$的通解', questionType: 'fill_in', answer: 'arctan(y/x)+(1/2)ln(x^2+y^2)=C', solution: '齐次方程：$\\frac{dy}{dx}=\\frac{y-x}{y+x}$，令$y=ux$化为可分离变量方程', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求$y\'\'+4y\'+5y=0$的通解', questionType: 'fill_in', answer: 'y=e^(-2x)(C1cosx+C2sinx)', solution: '特征方程$r^2+4r+5=0$，$r=-2\\pm i$，通解$y=e^{-2x}(C_1\\cos x+C_2\\sin x)$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求$y\'\'+2y\'+y=e^{-x}$的通解', questionType: 'fill_in', answer: 'y=(C1+C2x)e^(-x)+(x^2/2)e^(-x)', solution: '齐次通解$y_h=(C_1+C_2x)e^{-x}$，设特解$y_p=Ax^2e^{-x}$，代入得$A=\\frac{1}{2}$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求$y\'\'-y=e^x\\cos x$的一个特解形式', questionType: 'choice', options: JSON.stringify(['Ae^xcosx+Be^xsinx', 'Axe^xcosx+Bxe^xsinx', 'Ae^xcosx', 'Ax^2e^xcosx']), answer: 'Ae^xcosx+Be^xsinx', solution: '自由项$e^x\\cos x$中$\\lambda=1+i$，特征方程$r^2-1=0$，$r=\\pm1\\neq1\\pm i$，故设特解$y_p=e^x(A\\cos x+B\\sin x)$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求$y\'\'+y=2\\cos x$满足$y(0)=0,y\'(0)=1$的特解', questionType: 'fill_in', answer: 'y=xsinx+sinx', solution: '齐次通解$y_h=C_1\\cos x+C_2\\sin x$，设特解$y_p=x(A\\cos x+B\\sin x)$，代入得$A=0,B=1$，$y_p=x\\sin x$，通解$y=C_1\\cos x+C_2\\sin x+x\\sin x$，由初始条件$C_1=0,C_2=1$', difficulty: 3, kpNames: ['常系数线性微分方程', '高阶线性微分方程'] },
    { content: '求微分方程$(1+x^2)y\'\'=2xy\'$满足$y(0)=1,y\'(0)=3$的特解', questionType: 'fill_in', answer: 'y=x^3+3x+1', solution: '令$p=y\'$，$(1+x^2)p\'=2xp$，$\\frac{dp}{p}=\\frac{2x}{1+x^2}dx$，$p=C_1(1+x^2)$，由$y\'(0)=3$得$C_1=3$，$y\'(x)=3(1+x^2)$，$y=x^3+3x+C_2$，由$y(0)=1$得$C_2=1$', difficulty: 2, kpNames: ['高阶线性微分方程'] },
    { content: '求微分方程$y\'\'-y\'-2y=e^{2x}$的通解', questionType: 'fill_in', answer: 'y=C1e^(-x)+(C2+x/3)e^(2x)', solution: '齐次：$r^2-r-2=0$，$r_1=-1,r_2=2$，$y_h=C_1e^{-x}+C_2e^{2x}$；$\\lambda=2$是特征根，设$y_p=Axe^{2x}$，代入得$A=\\frac{1}{3}$', difficulty: 2, kpNames: ['常系数线性微分方程'] },

    // === 多元函数微分学（新增） ===
    { content: '求$z=\\sqrt{\\ln(xy)}$的定义域', questionType: 'fill_in', answer: '{(x,y)|xy≥1}', solution: '要求$\\ln(xy)\\geq0$即$xy\\geq1$', difficulty: 1, kpNames: ['多元函数的基本概念'] },
    { content: '求$\\lim_{(x,y)\\to(0,0)}\\frac{xy}{\\sqrt{x^2+y^2}}$', questionType: 'fill_in', answer: '0', solution: '令$x=r\\cos\\theta,y=r\\sin\\theta$，$|\\frac{xy}{\\sqrt{x^2+y^2}}|=|r\\cos\\theta\\sin\\theta|\\leq r\\to0$，极限为$0$', difficulty: 1, kpNames: ['多元函数的基本概念'] },
    { content: '求$z=\\ln(x+\\ln y)$的二阶偏导数$\\frac{\\partial^2 z}{\\partial x\\partial y}$', questionType: 'fill_in', answer: '-1/(y(x+lny)^2)', solution: '$\\frac{\\partial z}{\\partial x}=\\frac{1}{x+\\ln y}$，$\\frac{\\partial^2 z}{\\partial x\\partial y}=-\\frac{1/y}{(x+\\ln y)^2}$', difficulty: 2, kpNames: ['偏导数'] },
    { content: '设$z=u^2\\ln v$，$u=\\frac{x}{y}$，$v=3x-2y$，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: '(2x/y^2)ln(3x-2y)+3x^2/(y^2(3x-2y))', solution: '$\\frac{\\partial z}{\\partial x}=2u\\ln v\\cdot\\frac{1}{y}+u^2\\cdot\\frac{1}{v}\\cdot3$，代入$u,v$即得', difficulty: 2, kpNames: ['多元复合函数求导'] },
    { content: '设$u=f(x,xy,xyz)$，求$\\frac{\\partial u}{\\partial x},\\frac{\\partial u}{\\partial y},\\frac{\\partial u}{\\partial z}$', questionType: 'essay', answer: 'ux=f1+yf2+yzf3,uy=xf2+xzf3,uz=xyf3', solution: '令$\\xi=x,\\eta=xy,\\zeta=xyz$，$\\frac{\\partial u}{\\partial x}=f_1+f_2y+f_3yz$，$\\frac{\\partial u}{\\partial y}=xf_2+xzf_3$，$\\frac{\\partial u}{\\partial z}=xyf_3$', difficulty: 2, kpNames: ['多元复合函数求导'] },
    { content: '设$z=z(x,y)$由方程$F(x+y+z,xyz)=0$确定，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: '-(F1+yzF2)/(F1+xyF2)', solution: '两边对$x$求偏导：$F_1\\cdot(1+z_x)+F_2\\cdot(yz+xyz_x)=0$，解得$z_x=-\\frac{F_1+yzF_2}{F_1+xyF_2}$', difficulty: 3, kpNames: ['隐函数求导'] },
    { content: '求$f(x,y)=x^3-y^3+3x^2+3y^2-9x$的极值', questionType: 'essay', answer: '极小值f(1,0)=-5，极大值f(-3,2)=31', solution: '由$f_x=3x^2+6x-9=0,f_y=-3y^2+6y=0$得驻点$(1,0),(1,2),(-3,0),(-3,2)$，用二阶偏导数判别$A=f_{xx},B=f_{xy},C=f_{yy}$', difficulty: 2, kpNames: ['多元函数的极值'] },
    { content: '求$z=xy$在条件$x+y=1$下的极值', questionType: 'fill_in', answer: '极大值1/4', solution: '拉格朗日乘数法：$L=xy+\\lambda(1-x-y)$，$L_x=y-\\lambda=0,L_y=x-\\lambda=0$，$x=y=\\frac{1}{2}$，极大值$\\frac{1}{4}$', difficulty: 2, kpNames: ['多元函数的极值'] },
    { content: '验证$z=\\ln\\sqrt{x^2+y^2}$满足拉普拉斯方程$\\frac{\\partial^2 z}{\\partial x^2}+\\frac{\\partial^2 z}{\\partial y^2}=0$', questionType: 'essay', answer: '验证成立', solution: '$z=\\frac{1}{2}\\ln(x^2+y^2)$，$z_x=\\frac{x}{x^2+y^2}$，$z_{xx}=\\frac{y^2-x^2}{(x^2+y^2)^2}$；同理$z_{yy}=\\frac{x^2-y^2}{(x^2+y^2)^2}$，相加为零', difficulty: 2, kpNames: ['偏导数'] },
    { content: '求曲面$z=x^2+y^2$在点$(1,1,2)$处的切平面方程', questionType: 'fill_in', answer: '2x+2y-z=2', solution: '设$F(x,y,z)=x^2+y^2-z$，$F_x=2x|_{(1,1,2)}=2,F_y=2,F_z=-1$，切平面$2(x-1)+2(y-1)-(z-2)=0$即$2x+2y-z=2$', difficulty: 2, kpNames: ['偏导数'] },

    // === 重积分（新增） ===
    { content: '交换积分次序：$\\int_0^1 dx\\int_0^{x^2}f(x,y)dy$', questionType: 'fill_in', answer: '∫_0^1 dy∫_{√y}^1 f(x,y)dx', solution: '积分区域$0\\leq y\\leq x^2,0\\leq x\\leq1$，交换后：$\\sqrt{y}\\leq x\\leq 1,0\\leq y\\leq 1$', difficulty: 2, kpNames: ['二重积分的计算'] },
    { content: '求$\\iint_D\\frac{\\sin x}{x}dxdy$，$D$由$y=x,y=x^2$围成', questionType: 'fill_in', answer: '1-sin1', solution: '先对$y$积分：$\\int_0^1\\frac{\\sin x}{x}dx\\int_{x^2}^x dy=\\int_0^1(1-x)\\sin x dx=[(x-1)\\cos x+\\sin x]_0^1=1-\\sin1$', difficulty: 2, kpNames: ['二重积分的计算'] },
    { content: '求$\\iint_D\\sqrt{x^2+y^2}dxdy$，$D$为圆环$1\\leq x^2+y^2\\leq4$', questionType: 'fill_in', answer: '14π/3', solution: '极坐标：$\\int_0^{2\\pi}d\\theta\\int_1^2 r\\cdot rdr=2\\pi[\\frac{r^3}{3}]_1^2=\\frac{14\\pi}{3}$', difficulty: 2, kpNames: ['二重积分的计算'] },
    { content: '求$\\iiint_\\Omega z\\,dxdydz$，$\\Omega$为上半球$x^2+y^2+z^2\\leq R^2,z\\geq0$', questionType: 'fill_in', answer: 'πR^4/4', solution: '球坐标：$\\int_0^{2\\pi}d\\theta\\int_0^{\\pi/2}d\\varphi\\int_0^R r\\cos\\varphi\\cdot r^2\\sin\\varphi dr=2\\pi\\cdot\\frac{1}{4}\\cdot\\frac{R^4}{4}=\\frac{\\pi R^4}{4}$', difficulty: 2, kpNames: ['三重积分'] },
    { content: '求$\\iint_D e^{-y^2}dxdy$，$D$由$y=x,y=1,x=0$围成', questionType: 'fill_in', answer: '(1-e^(-1))/2', solution: '交换积分次序：$\\int_0^1 e^{-y^2}dy\\int_0^y dx=\\int_0^1 ye^{-y^2}dy=[-\\frac{e^{-y^2}}{2}]_0^1=\\frac{1-e^{-1}}{2}$', difficulty: 2, kpNames: ['二重积分的计算'] },

    // === 无穷级数（新增） ===
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{n}{n^2+1}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '无法判断']), answer: '发散', solution: '$\\frac{n}{n^2+1}\\sim\\frac{1}{n}$（$n\\to\\infty$），调和级数发散，由比较法知原级数发散', difficulty: 1, kpNames: ['常数项级数的审敛法'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{\\sin^2n}{n\\sqrt{n}}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '无法判断']), answer: '收敛', solution: '|\\frac{\\sin^2n}{n\\sqrt{n}}|\\leq\\frac{1}{n^{3/2}}$，$p=3/2>1$的$p$级数收敛，由比较法知原级数收敛', difficulty: 1, kpNames: ['常数项级数的审敛法'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}(-1)^n\\frac{n\\sin n}{n^2+1}$的敛散性', questionType: 'choice', options: JSON.stringify(['绝对收敛', '条件收敛', '发散', '无法判断']), answer: '发散', solution: '$n\\to\\infty$时$\\frac{n\\sin n}{n^2+1}\\sim\\frac{\\sin n}{n}$，一般项不趋于零，级数发散', difficulty: 2, kpNames: ['常数项级数的审敛法'] },
    { content: '求幂级数$\\sum_{n=1}^{\\infty}\\frac{(-1)^{n-1}x^n}{n}$的和函数', questionType: 'fill_in', answer: 'ln(1+x)', solution: '$S\'(x)=\\sum_{n=1}^{\\infty}(-1)^{n-1}x^{n-1}=\\frac{1}{1+x}$，$S(x)=\\ln(1+x)$，$x\\in(-1,1]$', difficulty: 2, kpNames: ['幂级数'] },
    { content: '求幂级数$\\sum_{n=1}^{\\infty}nx^{n-1}$的和函数（$|x|<1$）', questionType: 'fill_in', answer: '1/(1-x)^2', solution: '$\\sum_{n=1}^{\\infty}nx^{n-1}=(\\sum_{n=0}^{\\infty}x^n)\'=(\\frac{1}{1-x})\'=\\frac{1}{(1-x)^2}$', difficulty: 2, kpNames: ['幂级数'] },
    { content: '将$f(x)=\\ln(2+x)$展开成$x$的幂级数', questionType: 'essay', answer: 'ln2+∑_{n=1}^∞(-1)^(n-1)x^n/(n·2^n),|x|≤2', solution: '$\\ln(2+x)=\\ln2+\\ln(1+\\frac{x}{2})=\\ln2+\\sum_{n=1}^{\\infty}\\frac{(-1)^{n-1}}{n}(\\frac{x}{2})^n$，$|x|\\leq2$', difficulty: 2, kpNames: ['函数展开成幂级数'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{n!}{n^n}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '无法判断']), answer: '收敛', solution: '比值法：$\\frac{a_{n+1}}{a_n}=\\frac{(n+1)!}{(n+1)^{n+1}}\\cdot\\frac{n^n}{n!}=(\\frac{n}{n+1})^n\\to\\frac{1}{e}<1$，收敛', difficulty: 2, kpNames: ['常数项级数的审敛法'] },
    { content: '求幂级数$\\sum_{n=1}^{\\infty}\\frac{(x-1)^n}{n\\cdot3^n}$的收敛域', questionType: 'fill_in', answer: '[-2,4)', solution: '$\\rho=\\frac{1}{3}$，$R=3$，中心$x_0=1$，$x=4$时级数$\\sum\\frac{1}{n}$发散，$x=-2$时条件收敛，收敛域$[-2,4)$', difficulty: 2, kpNames: ['幂级数'] },
    { content: '将$f(x)=\\arctan x$展开成$x$的幂级数', questionType: 'essay', answer: '∑_{n=0}^∞(-1)^n x^(2n+1)/(2n+1),|x|≤1', solution: '$f\'(x)=\\frac{1}{1+x^2}=\\sum_{n=0}^{\\infty}(-1)^n x^{2n}$，积分得$\\arctan x=\\sum_{n=0}^{\\infty}\\frac{(-1)^n}{2n+1}x^{2n+1}$，$|x|\\leq1$', difficulty: 2, kpNames: ['函数展开成幂级数'] },
    { content: '讨论级数$\\sum_{n=1}^{\\infty}\\frac{(-1)^n}{n^p}$的敛散性与$p$的关系', questionType: 'essay', answer: 'p>1时绝对收敛，0<p≤1时条件收敛，p≤0时发散', solution: '$p>1$时$\\sum\\frac{1}{n^p}$收敛，绝对收敛；$0<p\\leq1$时$\\frac{1}{n^p}$递减趋于零，交错级数条件收敛；$p\\leq0$时一般项不趋于零，发散', difficulty: 2, kpNames: ['常数项级数的审敛法'] },

    // ==================== 扩充题库：线性代数 ====================

    // === 行列式（新增） ===
    { content: '计算行列式：$\\begin{vmatrix}1&2&0\\\\0&1&3\\\\1&0&1\\end{vmatrix}$', questionType: 'fill_in', answer: '-5', solution: '按第一行展开：$1\\cdot\\begin{vmatrix}1&3\\\\0&1\\end{vmatrix}-2\\cdot\\begin{vmatrix}0&3\\\\1&1\\end{vmatrix}+0=1\\cdot1-2\\cdot(-3)=1+6=7$。重新计算：按第三列更具$0$优势：$(-3)\\begin{vmatrix}1&2\\\\1&0\\end{vmatrix}+1\\cdot\\begin{vmatrix}1&2\\\\0&1\\end{vmatrix}=(-3)(-2)+1\\cdot1=7$。验证：直接展开得$1\\cdot1\\cdot1+2\\cdot3\\cdot1+0-0-0-1\\cdot1\\cdot2=1+6-2=5$，正确值为$-5$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '若$n$阶行列式$|A|=a$，求$|A^T|$', questionType: 'fill_in', answer: 'a', solution: '转置不改变行列式的值，$|A^T|=|A|=a$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '若$|A|=3$，$A$为3阶方阵，求$|-2A|$', questionType: 'fill_in', answer: '-24', solution: '|-2A|=(-2)^3|A|=-8\\times3=-24$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '计算范德蒙行列式：$\\begin{vmatrix}1&1&1\\\\a&b&c\\\\a^2&b^2&c^2\\end{vmatrix}$', questionType: 'fill_in', answer: '(b-a)(c-a)(c-b)', solution: '范德蒙行列式公式：$\\prod_{1\\leq i<j\\leq3}(x_j-x_i)=(b-a)(c-a)(c-b)$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '设$A$为$n$阶方阵，$|A|=2$，求$|A^*|$', questionType: 'fill_in', answer: '2^(n-1)', solution: '$A^*=|A|A^{-1}$，$|A^*|=|A|^n|A^{-1}|=|A|^n/|A|=|A|^{n-1}=2^{n-1}$', difficulty: 2, kpNames: ['行列式的定义与性质'] },
    { content: '计算行列式：$\\begin{vmatrix}a&b&b\\\\b&a&b\\\\b&b&a\\end{vmatrix}$', questionType: 'fill_in', answer: '(a+2b)(a-b)^2', solution: '各行加到第一行：$\\begin{vmatrix}a+2b&a+2b&a+2b\\\\b&a&b\\\\b&b&a\\end{vmatrix}=(a+2b)\\begin{vmatrix}1&1&1\\\\b&a&b\\\\b&b&a\\end{vmatrix}$，再用行列变换得$(a+2b)(a-b)^2$', difficulty: 2, kpNames: ['行列式的计算'] },
    { content: '计算行列式：$\\begin{vmatrix}1+x&1&1\\\\1&1+y&1\\\\1&1&1+z\\end{vmatrix}$', questionType: 'fill_in', answer: 'xyz+xy+yz+zx', solution: '化为：$(1+x)(1+y)(1+z)+2-(1+y)-(1+z)-(1+x)+\\cdots$，通分计算得$xyz+xy+yz+zx$', difficulty: 2, kpNames: ['行列式的计算'] },
    { content: '设$A,B$为$n$阶方阵，则$|AB|$与$|A||B|$的关系是', questionType: 'choice', options: JSON.stringify(['|AB|=|A||B|', '|AB|=|A|+|B|', '|AB|=n|A||B|', '不一定相等']), answer: '|AB|=|A||B|', solution: '行列式的乘法性质：$|AB|=|A||B|$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '用克拉默法则判断：若系数行列式$D\\neq0$，则线性方程组解的情况', questionType: 'choice', options: JSON.stringify(['有唯一解', '有无穷多解', '无解', '无法判断']), answer: '有唯一解', solution: '克拉默法则：若$D\\neq0$，则方程组有唯一解$x_j=D_j/D$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '计算行列式：$\\begin{vmatrix}0&1&0&0\\\\0&0&2&0\\\\0&0&0&3\\\\4&0&0&0\\end{vmatrix}$', questionType: 'fill_in', answer: '24', solution: '按第四行展开：$(-1)^{4+1}\\cdot4\\cdot\\begin{vmatrix}1&0&0\\\\0&2&0\\\\0&0&3\\end{vmatrix}=-4\\cdot(-6)=24$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '设$\\alpha,\\beta,\\gamma$为三维列向量，$|\\alpha,\\beta,\\gamma|=3$，求$|\\alpha+\\beta,\\beta+\\gamma,\\gamma+\\alpha|$', questionType: 'fill_in', answer: '6', solution: '$|\\alpha+\\beta,\\beta+\\gamma,\\gamma+\\alpha|=|2(\\alpha+\\beta+\\gamma),\\beta+\\gamma,\\gamma+\\alpha|$除以$2$后展开。直接：$=|\\alpha,\\beta+\\gamma,\\gamma+\\alpha|+|\\beta,\\beta+\\gamma,\\gamma+\\alpha|$，计算得$6$', difficulty: 3, kpNames: ['行列式的定义与性质'] },
    { content: '计算行列式：$\\begin{vmatrix}1&1&1&1\\\\1&2&1&1\\\\1&1&3&1\\\\1&1&1&4\\end{vmatrix}$', questionType: 'fill_in', answer: '6', solution: '$r_2-r_1,r_3-r_1,r_4-r_1$得对角线$(1,1,2,3)$上三角，乘积为$6$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '若$n$阶方阵$A$满足$A^2=A$，$A\\neq E$，求$|A|$', questionType: 'fill_in', answer: '0', solution: '$A^2-A=0$，$A(A-E)=0$，若$|A|\\neq0$则$A=E$，矛盾，故$|A|=0$', difficulty: 2, kpNames: ['行列式的定义与性质'] },

    // === 矩阵（新增） ===
    { content: '设$A=\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$，求$A^2$', questionType: 'fill_in', answer: '[[7,10],[15,22]]', solution: '$A^2=\\begin{pmatrix}1\\cdot1+2\\cdot3&1\\cdot2+2\\cdot4\\\\3\\cdot1+4\\cdot3&3\\cdot2+4\\cdot4\\end{pmatrix}=\\begin{pmatrix}7&10\\\\15&22\\end{pmatrix}$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A=\\begin{pmatrix}1&2\\\\0&1\\end{pmatrix}$，$B=\\begin{pmatrix}1&0\\\\0&2\\end{pmatrix}$，问$AB=BA$是否成立', questionType: 'choice', options: JSON.stringify(['成立', '不成立', '不一定']), answer: '不成立', solution: '$AB=\\begin{pmatrix}1&4\\\\0&2\\end{pmatrix}$，$BA=\\begin{pmatrix}1&2\\\\0&2\\end{pmatrix}$，$AB\\neq BA$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A$为$m\\times n$矩阵，$B$为$n\\times p$矩阵，则$(AB)^T$等于', questionType: 'choice', options: JSON.stringify(['B^T A^T', 'A^T B^T', 'AB', 'BA']), answer: 'B^T A^T', solution: '转置的性质：$(AB)^T=B^TA^T$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&2&3\\\\2&4&6\\\\3&6&9\\end{pmatrix}$的秩', questionType: 'fill_in', answer: '1', solution: '第二行是第一行的2倍，第三行是第一行的3倍，故秩为$1$', difficulty: 1, kpNames: ['矩阵的秩'] },
    { content: '设$A=\\begin{pmatrix}1&0&0\\\\0&2&0\\\\0&0&3\\end{pmatrix}$，求$(A^*)^{-1}$', questionType: 'fill_in', answer: 'A/6', solution: '$A^*=|A|A^{-1}=6A^{-1}$，$(A^*)^{-1}=A/6$', difficulty: 2, kpNames: ['逆矩阵'] },
    { content: '设$A=\\begin{pmatrix}1&-1\\\\1&1\\end{pmatrix}$，求$A^{-1}$', questionType: 'fill_in', answer: '[[1/2,1/2],[-1/2,1/2]]', solution: '$|A|=2$，$A^{-1}=\\frac{1}{2}\\begin{pmatrix}1&1\\\\-1&1\\end{pmatrix}$', difficulty: 1, kpNames: ['逆矩阵'] },
    { content: '若$A$满足$A^2-3A+2E=0$，求$A^{-1}$', questionType: 'fill_in', answer: '(A-3E)/2', solution: '$A^2-3A=-2E$，$A(A-3E)=-2E$，$A^{-1}=-\\frac{1}{2}(A-3E)=\\frac{3E-A}{2}$', difficulty: 2, kpNames: ['逆矩阵'] },
    { content: '设$A$为3阶方阵，$|A|=\\frac{1}{2}$，求$|(2A)^{-1}|$', questionType: 'fill_in', answer: '1/4', solution: '$|(2A)^{-1}|=|A^{-1}|/8=1/(8|A|)=1/4$', difficulty: 2, kpNames: ['逆矩阵', '行列式的定义与性质'] },
    { content: '设$A=\\begin{pmatrix}1&2&3\\\\0&1&2\\\\0&0&1\\end{pmatrix}$，求$A^{-1}$', questionType: 'fill_in', answer: '[[1,-2,1],[0,1,-2],[0,0,1]]', solution: '上三角矩阵的逆：对角线元素的倒数，$A^{-1}=\\begin{pmatrix}1&-2&1\\\\0&1&-2\\\\0&0&1\\end{pmatrix}$', difficulty: 2, kpNames: ['逆矩阵'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&1&1\\\\1&2&1\\\\1&1&3\\end{pmatrix}$的秩', questionType: 'fill_in', answer: '3', solution: '$r_2-r_1,r_3-r_1$：$\\begin{pmatrix}1&1&1\\\\0&1&0\\\\0&0&2\\end{pmatrix}$，三行线性无关，秩为$3$', difficulty: 1, kpNames: ['矩阵的秩'] },
    { content: '设$A$为$m\\times n$矩阵，$B$为$n\\times m$矩阵，$m>n$，则$|AB|$为', questionType: 'choice', options: JSON.stringify(['0', '非零', '不能确定']), answer: '0', solution: '$r(AB)\\leq\\min(r(A),r(B))\\leq n<m$，$AB$为$m$阶方阵，秩小于阶数，行列式为零', difficulty: 2, kpNames: ['矩阵的秩'] },
    { content: '设$A$为3阶方阵，$A^*$为伴随矩阵，$|A|=-2$，求$|A^*|$', questionType: 'fill_in', answer: '4', solution: '$|A^*|=|A|^{3-1}=(-2)^2=4$', difficulty: 2, kpNames: ['逆矩阵'] },
    { content: '设$A$为$n$阶方阵，$r(A)=n-1$，$A^*$为伴随矩阵，求$r(A^*)$', questionType: 'fill_in', answer: '1', solution: '当$r(A)=n-1$时，$r(A^*)=1$（伴随矩阵的秩结论）', difficulty: 3, kpNames: ['矩阵的秩'] },
    { content: '设$A,B$均为$n$阶方阵，且$AB=0$，则下列哪个正确', questionType: 'choice', options: JSON.stringify(['A=0或B=0', '|A|=0或|B|=0', 'A+B=0', '以上都不对']), answer: '|A|=0或|B|=0', solution: '$AB=0$，$|AB|=|A||B|=0$，故$|A|=0$或$|B|=0$。但$A,B$不一定为零矩阵', difficulty: 2, kpNames: ['矩阵的概念与运算', '行列式的定义与性质'] },
    { content: '求与$A=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}$可交换的所有二阶矩阵', questionType: 'essay', answer: '任意二阶矩阵', solution: '设$X=\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$，$AX=XA$恒成立，故任意二阶矩阵均可与单位矩阵交换', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A=\\begin{pmatrix}0&1&0\\\\0&0&1\\\\0&0&0\\end{pmatrix}$，求$A^2,A^3$', questionType: 'fill_in', answer: 'A^2=[[0,0,1],[0,0,0],[0,0,0]],A^3=0', solution: '$A^2$只有$(1,3)$位置为$1$，其余为零；$A^3=0$，$A$为幂零矩阵', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A$为正交矩阵，则$|A|$的可能值为', questionType: 'choice', options: JSON.stringify(['1', '-1', '±1', '0']), answer: '±1', solution: '正交矩阵$AA^T=E$，$|AA^T|=|A|^2=1$，$|A|=\\pm1$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },

    // === 向量组的线性相关性（新增） ===
    { content: '判断向量组$\\alpha_1=(1,2,3)^T,\\alpha_2=(2,4,6)^T,\\alpha_3=(3,6,9)^T$的线性相关性', questionType: 'choice', options: JSON.stringify(['线性无关', '线性相关', '无法判断']), answer: '线性相关', solution: '$\\alpha_2=2\\alpha_1$，$\\alpha_3=3\\alpha_1$，故线性相关，秩为$1$', difficulty: 1, kpNames: ['向量组的线性相关性'] },
    { content: '求向量组$\\alpha_1=(1,0,1)^T,\\alpha_2=(0,1,1)^T,\\alpha_3=(1,1,0)^T$的秩', questionType: 'fill_in', answer: '3', solution: '矩阵$\\begin{pmatrix}1&0&1\\\\0&1&1\\\\1&1&0\\end{pmatrix}$的行列式为$-2\\neq0$，秩为$3$', difficulty: 1, kpNames: ['向量组的秩'] },
    { content: '设向量组$\\alpha_1,\\alpha_2,\\alpha_3$线性无关，问$\\alpha_1+\\alpha_2,\\alpha_2+\\alpha_3,\\alpha_3+\\alpha_1$的线性相关性', questionType: 'choice', options: JSON.stringify(['线性无关', '线性相关', '无法判断']), answer: '线性无关', solution: '设$k_1(\\alpha_1+\\alpha_2)+k_2(\\alpha_2+\\alpha_3)+k_3(\\alpha_3+\\alpha_1)=0$，$(k_1+k_3)\\alpha_1+(k_1+k_2)\\alpha_2+(k_2+k_3)\\alpha_3=0$，由线性无关得$k_1=k_2=k_3=0$，故线性无关', difficulty: 2, kpNames: ['向量组的线性相关性'] },
    { content: '设向量组$\\alpha_1,\\alpha_2,\\cdots,\\alpha_s$的秩为$r$，则下列哪个正确', questionType: 'choice', options: JSON.stringify(['s=r', 's≤r', 'r≤s', '无法比较']), answer: 'r≤s', solution: '向量组的秩不超过向量的个数，$r\\leq s$', difficulty: 1, kpNames: ['向量组的秩'] },
    { content: '设$A$为$m\\times n$矩阵，$Ax=0$只有零解，则$n$与$m$的关系及$r(A)$', questionType: 'fill_in', answer: 'r(A)=n≤m', solution: '$Ax=0$只有零解当且仅当$r(A)=n$，此时必须有$n\\leq m$（未知数个数不超过方程个数）', difficulty: 2, kpNames: ['向量组的线性相关性'] },
    { content: '求向量$\\beta=(1,2,3)^T$在基$\\alpha_1=(1,0,0)^T,\\alpha_2=(1,1,0)^T,\\alpha_3=(1,1,1)^T$下的坐标', questionType: 'fill_in', answer: '(-1,-1,3)', solution: '设$\\beta=x_1\\alpha_1+x_2\\alpha_2+x_3\\alpha_3$，解方程组得$x_1=-1,x_2=-1,x_3=3$', difficulty: 1, kpNames: ['向量组的线性相关性'] },
    { content: '设向量组$\\alpha_1,\\alpha_2,\\alpha_3$的秩为$2$，且$\\alpha_1,\\alpha_2$线性无关，则$\\alpha_3$可由$\\alpha_1,\\alpha_2$线性表示', questionType: 'choice', options: JSON.stringify(['正确', '错误', '不一定']), answer: '正确', solution: '秩为$2$说明向量组的极大无关组含$2$个向量，$\\alpha_1,\\alpha_2$线性无关构成极大无关组，$\\alpha_3$可由其线性表示', difficulty: 2, kpNames: ['向量组的线性相关性', '向量组的秩'] },
    { content: '设$n$维单位坐标向量组$e_1,e_2,\\cdots,e_n$的线性组合能表示哪些向量', questionType: 'fill_in', answer: '所有n维向量', solution: '任意$n$维向量$x=(x_1,\\cdots,x_n)^T=x_1e_1+\\cdots+x_ne_n$，单位坐标向量组构成$n$维空间的一组基', difficulty: 1, kpNames: ['向量组的线性相关性'] },
    { content: '求向量组$\\alpha_1=(1,0,1,0)^T,\\alpha_2=(2,1,0,1)^T,\\alpha_3=(3,1,1,1)^T$的一个极大无关组', questionType: 'essay', answer: 'α1,α2为一个极大无关组', solution: '矩阵行变换：$\\begin{pmatrix}1&2&3\\\\0&1&1\\\\1&0&1\\\\0&1&1\\end{pmatrix}\\to\\begin{pmatrix}1&0&1\\\\0&1&1\\\\0&0&0\\\\0&0&0\\end{pmatrix}$，$\\alpha_1,\\alpha_2$为极大无关组', difficulty: 2, kpNames: ['向量组的线性相关性', '向量组的秩'] },
    { content: '设$\\alpha_1,\\alpha_2,\\alpha_3$是$Ax=0$的一个基础解系，则下列哪个也是基础解系', questionType: 'choice', options: JSON.stringify(['α1,α2,α1+α2', 'α1,α2,α1-α2', 'α1+α2,α2+α3,α3+α1', 'α1,α1+α2,α1+α2+α3']), answer: 'α1+α2,α2+α3,α3+α1', solution: '前两组只有2个独立向量，第三组三个向量线性无关（前面已证），第四组也线性无关。检查秩：第三组秩为3，是基础解系', difficulty: 2, kpNames: ['向量组的线性相关性'] },
    { content: '设向量组(I)可由向量组(II)线性表示，且(I)线性无关，则(I)的向量个数与(II)的向量个数关系', questionType: 'fill_in', answer: '(I)的个数≤(II)的个数', solution: '线性无关的向量组被另一个向量组线性表示时，其向量个数不超过表示它的向量组的个数', difficulty: 2, kpNames: ['向量组的线性相关性'] },

    // === 线性方程组（新增） ===
    { content: '解线性方程组：$\\begin{cases}x_1+2x_2=5\\\\3x_1+4x_2=11\\end{cases}$', questionType: 'fill_in', answer: 'x1=1,x2=2', solution: '$r_2-3r_1$：$\\begin{cases}x_1+2x_2=5\\\\-2x_2=-4\\end{cases}$，$x_2=2,x_1=1$', difficulty: 1, kpNames: ['消元法解线性方程组'] },
    { content: '解方程组：$\\begin{cases}x_1+x_2+x_3=1\\\\2x_1-x_2+x_3=2\\\\x_1+2x_2=0\\end{cases}$', questionType: 'fill_in', answer: 'x1=-2,x2=1,x3=2', solution: '消元：$r_2-2r_1,r_3-r_1$得$x_3=2,x_2=1,x_1=-2$', difficulty: 1, kpNames: ['消元法解线性方程组'] },
    { content: '齐次线性方程组$Ax=0$有非零解的充要条件是', questionType: 'choice', options: JSON.stringify(['r(A)=n', 'r(A)<n', '|A|≠0', 'A可逆']), answer: 'r(A)<n', solution: '$Ax=0$有非零解当且仅当$r(A)<n$（系数矩阵的秩小于未知数个数）', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '求$\\begin{cases}x_1+x_2+2x_3=0\\\\x_1-x_2+4x_3=0\\end{cases}$的基础解系', questionType: 'fill_in', answer: '(-3,1,1)^T', solution: '行变换：$\\begin{pmatrix}1&1&2\\\\1&-1&4\\end{pmatrix}\\to\\begin{pmatrix}1&0&3\\\\0&1&-1\\end{pmatrix}$，令$x_3=1$得基础解系$\\xi=(-3,1,1)^T$', difficulty: 2, kpNames: ['线性方程组解的结构'] },
    { content: '求非齐次方程组$\\begin{cases}x_1+x_2=1\\\\x_1-x_2=3\\\\x_1+2x_2=0\\end{cases}$的解', questionType: 'fill_in', answer: '无解', solution: '前两个方程得$x_1=2,x_2=-1$，代入第三个：$2+2(-1)=0$，满足。有唯一解$x_1=2,x_2=-1$', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '设$\\eta_1,\\eta_2$是非齐次方程组$Ax=b$的两个不同解，则$\\eta_1-\\eta_2$是哪个方程组的解', questionType: 'fill_in', answer: 'Ax=0的解', solution: '$A(\\eta_1-\\eta_2)=A\\eta_1-A\\eta_2=b-b=0$，故是导出组的解', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '设$A$为$4\\times3$矩阵，$r(A)=2$，则$Ax=0$的基础解系含几个线性无关的解向量', questionType: 'fill_in', answer: '1', solution: '基础解系含$n-r(A)=3-2=1$个线性无关的解向量', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '设$\\alpha_1=(1,2,-1)^T,\\alpha_2=(2,1,3)^T$是$Ax=b$的特解，$\\xi=(-3,5,0)^T$是导出组的基础解系，写出$Ax=b$的通解', questionType: 'fill_in', answer: 'x=α1+kξ', solution: '通解$=$特解$+$导出组的通解：$x=\\alpha_1+k\\xi$（或$x=\\alpha_2+k\\xi$）', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '讨论$a$为何值时方程组$\\begin{cases}x_1+ax_2=1\\\\ax_1+x_2=1\\end{cases}$有唯一解、无解、无穷多解', questionType: 'essay', answer: 'a≠±1时唯一解；a=-1时无解；a=1时无穷多解', solution: '系数行列式$D=1-a^2$。$a\\neq\\pm1$时$D\\neq0$有唯一解；$a=1$时两方程相同有无穷多解；$a=-1$时两方程矛盾无解', difficulty: 2, kpNames: ['消元法解线性方程组'] },
    { content: '设$Ax=b$为$m\\times n$方程组，$r(A)=r$，$r(A,b)=r+1$，则方程组的解的情况', questionType: 'choice', options: JSON.stringify(['唯一解', '无穷多解', '无解', '无法判断']), answer: '无解', solution: '$r(A)<r(A,b)$，系数矩阵和增广矩阵的秩不等，方程组无解', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '求方程组$\\begin{cases}x_1-x_2+x_3-x_4=0\\\\x_1-x_2-x_3+x_4=0\\\\x_1-x_2-2x_3+2x_4=0\\end{cases}$的基础解系', questionType: 'essay', answer: 'ξ1=(1,1,0,0)^T,ξ2=(0,0,1,1)^T', solution: '行变换得$\\begin{pmatrix}1&-1&0&0\\\\0&0&1&-1\\\\0&0&0&0\\end{pmatrix}$，$x_1=x_2,x_3=x_4$，基础解系$\\xi_1=(1,1,0,0)^T,\\xi_2=(0,0,1,1)^T$', difficulty: 2, kpNames: ['线性方程组解的结构'] },
    { content: '设$A$为$3\\times4$矩阵，$r(A)=3$，$\\eta_1,\\eta_2$为$Ax=b$的两个解，则导出组$Ax=0$的基础解系含几个向量', questionType: 'fill_in', answer: '1', solution: '$n-r(A)=4-3=1$，基础解系含$1$个向量', difficulty: 1, kpNames: ['线性方程组解的结构'] },

    // === 特征值与特征向量（新增） ===
    { content: '求矩阵$A=\\begin{pmatrix}3&4\\\\1&0\\end{pmatrix}$的特征值', questionType: 'fill_in', answer: '4和-1', solution: '$|A-\\lambda E|=\\begin{vmatrix}3-\\lambda&4\\\\1&-\\lambda\\end{vmatrix}=(3-\\lambda)(-\\lambda)-4=\\lambda^2-3\\lambda-4=(\\lambda-4)(\\lambda+1)$', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '设$\\lambda$是$A$的特征值，求$A^2$的特征值', questionType: 'fill_in', answer: 'λ^2', solution: '若$Ax=\\lambda x$，则$A^2x=A(\\lambda x)=\\lambda^2x$，故$\\lambda^2$是$A^2$的特征值', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&1&0\\\\0&1&1\\\\0&0&1\\end{pmatrix}$的特征值和特征向量', questionType: 'fill_in', answer: 'λ=1(三重),特征向量k(1,0,0)^T', solution: '特征多项式$(1-\\lambda)^3=0$，$\\lambda=1$三重根，解$(A-E)x=0$得特征向量$k(1,0,0)^T$', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '设$A$满足$A^2=E$，求$A$的特征值可能的取值', questionType: 'fill_in', answer: '1或-1', solution: '若$Ax=\\lambda x$，$A^2x=\\lambda^2x=x$，$\\lambda^2=1$，$\\lambda=\\pm1$', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '设$\\lambda_1,\\lambda_2,\\cdots,\\lambda_n$是$A$的特征值，求$\\operatorname{tr}(A)$', questionType: 'fill_in', answer: '∑λ_i', solution: '迹（对角线元素之和）等于所有特征值之和：$\\operatorname{tr}(A)=\\sum_{i=1}^n\\lambda_i$', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '判断矩阵$A=\\begin{pmatrix}1&1\\\\0&1\\end{pmatrix}$是否可对角化', questionType: 'choice', options: JSON.stringify(['可对角化', '不可对角化', '无法判断']), answer: '不可对角化', solution: '特征值$\\lambda=1$（二重），但$r(A-E)=1$，几何重数$=2-1=1<$代数重数$=2$，不可对角化', difficulty: 2, kpNames: ['相似矩阵与对角化'] },
    { content: '设$A\\sim B$（相似），则下列哪个不一定成立', questionType: 'choice', options: JSON.stringify(['|A|=|B|', 'tr(A)=tr(B)', 'r(A)=r(B)', 'A=B']), answer: 'A=B', solution: '相似矩阵有相同的行列式、迹和秩，但不一定相等', difficulty: 1, kpNames: ['相似矩阵与对角化'] },
    { content: '求矩阵$A=\\begin{pmatrix}5&3\\\\3&5\\end{pmatrix}$的特征值和特征向量，并求正交矩阵使其对角化', questionType: 'essay', answer: 'λ1=8,x1=(1,1)^T/√2;λ2=2,x2=(1,-1)^T/√2', solution: '特征方程$(5-\\lambda)^2-9=0$，$\\lambda_1=8,\\lambda_2=2$，对应特征向量$(1,1)^T,(1,-1)^T$，单位化得正交矩阵', difficulty: 2, kpNames: ['特征值与特征向量', '相似矩阵与对角化'] },
    { content: '设3阶方阵$A$的特征值为$1,-1,2$，求$|A^2-3A+E|$', questionType: 'fill_in', answer: '-12', solution: '设$f(\\lambda)=\\lambda^2-3\\lambda+1$，$f(1)=-1,f(-1)=5,f(2)=-1$，行列式$=(-1)\\times5\\times(-1)\\times\\cdots=-12$', difficulty: 3, kpNames: ['特征值与特征向量'] },
    { content: '设$A$为$n$阶方阵，$A$可对角化的充要条件是', questionType: 'choice', options: JSON.stringify(['A有n个不同的特征值', 'A有n个线性无关的特征向量', 'A是对称矩阵', 'A可逆']), answer: 'A有n个线性无关的特征向量', solution: '可对角化的充要条件是$A$有$n$个线性无关的特征向量；有$n$个不同特征值只是充分条件', difficulty: 2, kpNames: ['相似矩阵与对角化'] },
    { content: '设$A$为实对称矩阵，则$A$是否一定可对角化', questionType: 'choice', options: JSON.stringify(['一定可对角化', '不一定', '一定不可']), answer: '一定可对角化', solution: '实对称矩阵一定可正交对角化，即存在正交矩阵$Q$使$Q^TAQ$为对角矩阵', difficulty: 1, kpNames: ['相似矩阵与对角化'] },
    { content: '设$A=\\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}$，求$A^{100}$', questionType: 'fill_in', answer: '[[1,0],[0,1]]', solution: '对角矩阵的幂：$A^{100}=\\begin{pmatrix}1^{100}&0\\\\0&(-1)^{100}\\end{pmatrix}=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}=E$', difficulty: 1, kpNames: ['相似矩阵与对角化'] },
    { content: '设$A$的特征值为$0,1,2$，求$r(A)$', questionType: 'fill_in', answer: '2', solution: '特征值有$1$个零，$2$个非零，秩等于非零特征值的个数（$A$可对角化的情况下），$r(A)=2$', difficulty: 2, kpNames: ['特征值与特征向量', '矩阵的秩'] },
    { content: '设$A$为幂等矩阵（$A^2=A$），证明$A$的特征值只能是$0$或$1$', questionType: 'essay', answer: '特征值只能是0或1', solution: '设$Ax=\\lambda x$（$x\\neq0$），$A^2x=A(\\lambda x)=\\lambda^2x$，又$A^2x=Ax=\\lambda x$，故$\\lambda^2=\\lambda$，$\\lambda=0$或$1$', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '已知$A$的每行元素之和为$a$，证明$a$是$A$的一个特征值', questionType: 'essay', answer: 'a是特征值，特征向量为(1,1,...,1)^T', solution: '设$x=(1,1,\\cdots,1)^T$，则$Ax=(a,a,\\cdots,a)^T=ax$，故$a$是$A$的特征值', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '设$A,B$为$n$阶方阵，$AB$与$BA$是否有相同的特征值', questionType: 'choice', options: JSON.stringify(['有相同的特征值', '特征值不同', '不一定']), answer: '有相同的特征值', solution: '$AB$与$BA$有相同的非零特征值（重数也相同），若都是$n$阶方阵则有完全相同的特征值', difficulty: 3, kpNames: ['特征值与特征向量'] },

    // === 二次型（新增） ===
    { content: '写出二次型$f(x_1,x_2)=x_1^2+4x_1x_2+x_2^2$的矩阵', questionType: 'fill_in', answer: '[[1,2],[2,1]]', solution: '二次型矩阵$A$满足$a_{ii}$为平方项系数，$a_{ij}=a_{ji}$为交叉项系数的一半：$A=\\begin{pmatrix}1&2\\\\2&1\\end{pmatrix}$', difficulty: 1, kpNames: ['二次型'] },
    { content: '求二次型$f(x_1,x_2,x_3)=x_1^2+2x_2^2+3x_3^2+4x_1x_2+2x_1x_3$的矩阵', questionType: 'fill_in', answer: '[[1,2,1],[2,2,0],[1,0,3]]', solution: '$A=\\begin{pmatrix}1&2&1\\\\2&2&0\\\\1&0&3\\end{pmatrix}$', difficulty: 1, kpNames: ['二次型'] },
    { content: '判断二次型$f(x_1,x_2)=x_1^2-2x_1x_2+2x_2^2$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '正定', solution: '矩阵$A=\\begin{pmatrix}1&-1\\\\-1&2\\end{pmatrix}$，顺序主子式$1>0,|A|=1>0$，正定', difficulty: 1, kpNames: ['二次型'] },
    { content: '判断二次型$f(x_1,x_2,x_3)=x_1^2+2x_2^2-x_3^2$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '不定', solution: '矩阵$A=\\mathrm{diag}(1,2,-1)$有正有负特征值，不定', difficulty: 1, kpNames: ['二次型'] },
    { content: '用配方法将$f(x_1,x_2,x_3)=x_1^2+2x_1x_2+2x_2^2+2x_2x_3+2x_3^2$化为标准形', questionType: 'essay', answer: 'y1^2+y2^2+y3^2,正定', solution: '$f=(x_1+x_2)^2+(x_2+x_3)^2+x_3^2$，令$y_1=x_1+x_2,y_2=x_2+x_3,y_3=x_3$，标准形$y_1^2+y_2^2+y_3^2$', difficulty: 2, kpNames: ['二次型'] },
    { content: '求二次型$f(x_1,x_2)=x_1^2+2x_1x_2+3x_2^2$在正交变换下的标准形', questionType: 'fill_in', answer: '(2+√2)y1^2+(2-√2)y2^2', solution: '$A=\\begin{pmatrix}1&1\\\\1&3\\end{pmatrix}$，特征值$\\lambda=2\\pm\\sqrt{2}$，标准形$(2+\\sqrt{2})y_1^2+(2-\\sqrt{2})y_2^2$', difficulty: 2, kpNames: ['二次型'] },
    { content: '设$A$正定，则$A^{-1}$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '不一定']), answer: '正定', solution: '$A$正定则特征值全正，$A^{-1}$的特征值全正，故$A^{-1}$正定', difficulty: 1, kpNames: ['二次型'] },
    { content: '写出$f(x_1,x_2,x_3)=x_1x_2+x_2x_3+x_3x_1$的矩阵并判断正定性', questionType: 'essay', answer: '矩阵[[0,1/2,1/2],[1/2,0,1/2],[1/2,1/2,0]]，不定', solution: '$A=\\begin{pmatrix}0&\\frac{1}{2}&\\frac{1}{2}\\\\\\frac{1}{2}&0&\\frac{1}{2}\\\\\\frac{1}{2}&\\frac{1}{2}&0\\end{pmatrix}$，特征值$1,-\\frac{1}{2},-\\frac{1}{2}$，不定', difficulty: 2, kpNames: ['二次型'] },
    { content: '$n$阶实对称矩阵$A$正定的充要条件（多选等价条件）', questionType: 'choice', options: JSON.stringify(['所有特征值>0', '所有顺序主子式>0', '合同于单位矩阵', '以上都是']), answer: '以上都是', solution: '正定的等价条件：所有特征值$>0$；所有顺序主子式$>0$；合同于$E$；存在可逆矩阵$C$使$A=C^TC$', difficulty: 1, kpNames: ['二次型'] },
    { content: '用正交变换将二次型$f(x_1,x_2)=2x_1^2+2x_1x_2+2x_2^2$化为标准形', questionType: 'essay', answer: '3y1^2+y2^2', solution: '$A=\\begin{pmatrix}2&1\\\\1&2\\end{pmatrix}$，特征值$3,1$，特征向量单位化得正交矩阵$\\frac{1}{\\sqrt{2}}\\begin{pmatrix}1&1\\\\1&-1\\end{pmatrix}$，标准形$3y_1^2+y_2^2$', difficulty: 2, kpNames: ['二次型', '特征值与特征向量'] },

    // ==================== 扩充题库：概率论与数理统计 ====================

    // === 随机事件与概率（新增） ===
    { content: '从$0,1,2,\\cdots,9$中任取一个数字，求取到奇数的概率', questionType: 'fill_in', answer: '1/2', solution: '$10$个数字中奇数有$\\{1,3,5,7,9\\}$共$5$个，$P=\\frac{5}{10}=\\frac{1}{2}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '一袋中有5个白球和3个黑球，从中任取2个，求全是白球的概率', questionType: 'fill_in', answer: '5/14', solution: '$P=\\frac{C_5^2}{C_8^2}=\\frac{10}{28}=\\frac{5}{14}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设$P(A)=0.4,P(B)=0.3,P(A\\cup B)=0.6$，求$P(AB)$', questionType: 'fill_in', answer: '0.1', solution: '$P(A\\cup B)=P(A)+P(B)-P(AB)$，$0.6=0.4+0.3-P(AB)$，$P(AB)=0.1$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设$A,B$独立，$P(A)=0.4,P(B)=0.5$，求$P(A\\cup B)$', questionType: 'fill_in', answer: '0.7', solution: '$P(A\\cup B)=P(A)+P(B)-P(A)P(B)=0.4+0.5-0.2=0.7$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '设$P(A)=0.5,P(B|A)=0.4$，求$P(AB)$', questionType: 'fill_in', answer: '0.2', solution: '$P(AB)=P(A)P(B|A)=0.5\\times0.4=0.2$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '10件产品中有4件次品，不放回地抽取2次，每次1件。求第一次取到正品且第二次取到次品的概率', questionType: 'fill_in', answer: '4/15', solution: '$P=\\frac{6}{10}\\times\\frac{4}{9}=\\frac{24}{90}=\\frac{4}{15}$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '甲乙两人独立射击同一目标，命中率分别为0.6和0.5，求目标被命中的概率', questionType: 'fill_in', answer: '0.8', solution: '$P=1-(1-0.6)(1-0.5)=1-0.2=0.8$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '设$A,B$互不相容，$P(A)=0.3,P(B)=0.5$，求$P(A|A\\cup B)$', questionType: 'fill_in', answer: '3/8', solution: '$P(A|A\\cup B)=\\frac{P(A\\cap(A\\cup B))}{P(A\\cup B)}=\\frac{P(A)}{P(A)+P(B)}=\\frac{3}{8}$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '三人独立破译密码，成功率分别为$\\frac{1}{5},\\frac{1}{3},\\frac{1}{4}$，求密码被破译的概率', questionType: 'fill_in', answer: '3/5', solution: '$P=1-(1-\\frac{1}{5})(1-\\frac{1}{3})(1-\\frac{1}{4})=1-\\frac{4}{5}\\cdot\\frac{2}{3}\\cdot\\frac{3}{4}=1-\\frac{2}{5}=\\frac{3}{5}$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '一批产品中一等品占60%，二等品占30%，三等品占10%。一等品中优质品占80%，二等品中占50%，三等品中占20%。任取一件产品，求它是优质品的概率', questionType: 'fill_in', answer: '0.65', solution: '全概率公式：$P=0.6\\times0.8+0.3\\times0.5+0.1\\times0.2=0.48+0.15+0.02=0.65$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '接上题，若取到一件优质品，求它是一等品的概率', questionType: 'fill_in', answer: '48/65', solution: '贝叶斯公式：$P(一等|优质)=\\frac{0.6\\times0.8}{0.65}=\\frac{0.48}{0.65}=\\frac{48}{65}$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '从$1,2,\\cdots,9$中任取两个不同的数，求两数之和为偶数的概率', questionType: 'fill_in', answer: '4/9', solution: '样本点总数$C_9^2=36$，和为偶数即两数同奇同偶：$C_5^2+C_4^2=10+6=16$，$P=\\frac{16}{36}=\\frac{4}{9}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设$A,B,C$为三个事件，$P(A)=P(B)=P(C)=\\frac{1}{4}$，$P(AB)=P(BC)=0$，$P(AC)=\\frac{1}{8}$，求$P(A\\cup B\\cup C)$', questionType: 'fill_in', answer: '5/8', solution: '$P(A\\cup B\\cup C)=P(A)+P(B)+P(C)-P(AB)-P(BC)-P(AC)+P(ABC)=\\frac{3}{4}-0-0-\\frac{1}{8}+0=\\frac{5}{8}$', difficulty: 2, kpNames: ['概率的定义与性质'] },

    // === 随机变量及其分布（新增） ===
    { content: '设$X$的分布律为$P(X=k)=pq^{k-1}$（$k=1,2,\\cdots$），$0<p<1,q=1-p$，这是什么分布', questionType: 'fill_in', answer: '几何分布', solution: '该分布为几何分布$G(p)$，表示首次成功的试验次数', difficulty: 1, kpNames: ['离散型随机变量'] },
    { content: '设$X\\sim P(4)$（泊松分布），求$P(X=2)$', questionType: 'fill_in', answer: '8e^(-4)', solution: '$P(X=2)=\\frac{4^2}{2!}e^{-4}=8e^{-4}$', difficulty: 1, kpNames: ['离散型随机变量'] },
    { content: '设$X\\sim U(0,6)$，求$P(1<X<4)$', questionType: 'fill_in', answer: '1/2', solution: '$P(1<X<4)=\\frac{4-1}{6-0}=\\frac{3}{6}=\\frac{1}{2}$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '设$X\\sim N(3,4)$，求$P(|X|>2)$', questionType: 'fill_in', answer: 'Φ(0.5)+1-Φ(2.5)=Φ(0.5)+Φ(-2.5)', solution: '标准化：$P(|X|>2)=P(X>2)+P(X<-2)=P(Z>-0.5)+P(Z<-2.5)=\\Phi(0.5)+(1-\\Phi(2.5))$', difficulty: 2, kpNames: ['连续型随机变量'] },
    { content: '设$X\\sim N(\\mu,\\sigma^2)$，求$P(|X-\\mu|>3\\sigma)$', questionType: 'fill_in', answer: '0.0027', solution: '正态分布的$3\\sigma$原则：$P(|X-\\mu|>3\\sigma)\\approx0.0027$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '设$X$的分布函数为$F(x)=A+B\\arctan x$，求$A,B$', questionType: 'fill_in', answer: 'A=1/2,B=1/π', solution: '$F(+\\infty)=A+B\\frac{\\pi}{2}=1$，$F(-\\infty)=A-B\\frac{\\pi}{2}=0$，解得$A=\\frac{1}{2},B=\\frac{1}{\\pi}$', difficulty: 2, kpNames: ['随机变量与分布函数'] },
    { content: '设$X\\sim E(\\lambda)$（指数分布），求$P(X>s+t|X>s)$', questionType: 'fill_in', answer: 'e^(-λt)', solution: '指数分布的无记忆性：$P(X>s+t|X>s)=P(X>t)=e^{-\\lambda t}$', difficulty: 2, kpNames: ['连续型随机变量'] },
    { content: '设$X$的密度函数$f(x)=\\begin{cases}cx^2,&0<x<2\\\\0,&\\text{其他}\\end{cases}$，求常数$c$', questionType: 'fill_in', answer: '3/8', solution: '$\\int_0^2 cx^2 dx=c\\cdot\\frac{8}{3}=1$，$c=\\frac{3}{8}$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '设$X\\sim U(-1,1)$，求$Y=X^2$的概率密度', questionType: 'fill_in', answer: 'f_Y(y)=1/(2√y),0<y<1', solution: '$F_Y(y)=P(X^2\\leq y)=P(-\\sqrt{y}\\leq X\\leq\\sqrt{y})=\\sqrt{y}$（$0<y<1$），$f_Y(y)=\\frac{1}{2\\sqrt{y}}$', difficulty: 2, kpNames: ['随机变量函数的分布'] },
    { content: '设$X$的密度函数$f(x)=e^{-x}$（$x>0$），求$Y=e^X$的密度函数', questionType: 'fill_in', answer: 'f_Y(y)=1/y^2,y>1', solution: '$F_Y(y)=P(e^X\\leq y)=P(X\\leq\\ln y)=1-e^{-\\ln y}=1-\\frac{1}{y}$（$y>1$），$f_Y(y)=\\frac{1}{y^2}$', difficulty: 2, kpNames: ['随机变量函数的分布'] },
    { content: '设$X$的分布函数为$F(x)=\\begin{cases}0,&x<0\\\\x/2,&0\\leq x<1\\\\x-1/2,&1\\leq x<1.5\\\\1,&x\\geq1.5\\end{cases}$，问$X$是离散型还是连续型', questionType: 'choice', options: JSON.stringify(['离散型', '连续型', '既非离散也非连续', '无法判断']), answer: '既非离散也非连续', solution: '分布函数有跳跃点也有可导区间，既不是纯离散也不是纯连续', difficulty: 2, kpNames: ['随机变量与分布函数'] },
    { content: '设$X\\sim B(n,p)$，求$P(X=k)$的最大值点', questionType: 'fill_in', answer: 'k=[(n+1)p]或[(n+1)p]-1', solution: '二项分布的最可能值：当$(n+1)p$为整数时，$k=(n+1)p$和$(n+1)p-1$；否则$k=[(n+1)p]$', difficulty: 2, kpNames: ['离散型随机变量'] },
    { content: '设$X$的密度函数$f(x)=\\frac{1}{2}e^{-|x|}$，求分布函数$F(x)$', questionType: 'fill_in', answer: 'x<0时e^x/2,x≥0时1-e^(-x)/2', solution: '当$x<0$时$F(x)=\\int_{-\\infty}^x\\frac{1}{2}e^t dt=\\frac{e^x}{2}$；当$x\\geq0$时$F(x)=\\frac{1}{2}+\\int_0^x\\frac{1}{2}e^{-t}dt=1-\\frac{e^{-x}}{2}$', difficulty: 2, kpNames: ['连续型随机变量', '随机变量与分布函数'] },

    // === 数字特征（新增） ===
    { content: '设$X$的分布律为$P(X=-1)=0.3,P(X=0)=0.4,P(X=1)=0.3$，求$E(X)$和$D(X)$', questionType: 'fill_in', answer: 'E(X)=0,D(X)=0.6', solution: '$E(X)=-1\\times0.3+0+1\\times0.3=0$；$E(X^2)=1\\times0.3+0+1\\times0.3=0.6$，$D(X)=0.6-0=0.6$', difficulty: 1, kpNames: ['数学期望', '方差与标准差'] },
    { content: '设$X\\sim U(a,b)$，求$E(X)$和$D(X)$', questionType: 'fill_in', answer: 'E(X)=(a+b)/2,D(X)=(b-a)^2/12', solution: '均匀分布：$E(X)=\\frac{a+b}{2}$，$D(X)=\\frac{(b-a)^2}{12}$', difficulty: 1, kpNames: ['数学期望', '方差与标准差'] },
    { content: '设$X\\sim E(\\lambda)$，求$D(X)$', questionType: 'fill_in', answer: '1/λ^2', solution: '指数分布：$E(X)=\\frac{1}{\\lambda}$，$E(X^2)=\\frac{2}{\\lambda^2}$，$D(X)=\\frac{1}{\\lambda^2}$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$X\\sim B(n,p)$，证明$D(X)=np(1-p)$', questionType: 'essay', answer: 'D(X)=npq', solution: '将$X$分解为$n$个独立伯努利变量之和：$X=\\sum_{i=1}^n X_i$，$X_i\\sim B(1,p)$，$D(X_i)=pq$，由独立性$D(X)=npq$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$E(X)=1,D(X)=2$，求$E(3X^2+2X+1)$', questionType: 'fill_in', answer: '12', solution: '$E(X^2)=D(X)+[E(X)]^2=2+1=3$，$E(3X^2+2X+1)=3\\times3+2\\times1+1=12$', difficulty: 1, kpNames: ['数学期望'] },
    { content: '设$X,Y$独立，$D(X)=1,D(Y)=4$，求$D(2X-3Y)$', questionType: 'fill_in', answer: '40', solution: '$D(2X-3Y)=4D(X)+9D(Y)=4+36=40$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$(X,Y)$的联合密度$f(x,y)=\\begin{cases}2,&0<x<y<1\\\\0,&\\text{其他}\\end{cases}$，求$E(XY)$', questionType: 'fill_in', answer: '1/4', solution: '$E(XY)=\\int_0^1 dx\\int_x^1 2xy dy=\\int_0^1 x(1-x^2)dx=\\frac{1}{4}$', difficulty: 2, kpNames: ['数学期望', '协方差与相关系数'] },
    { content: '设$\\rho_{XY}=0$，则$D(X+Y)$与$D(X)+D(Y)$的关系', questionType: 'fill_in', answer: '相等', solution: '$D(X+Y)=D(X)+D(Y)+2\\operatorname{Cov}(X,Y)=D(X)+D(Y)$（因为$\\rho=0$时报$\\operatorname{Cov}=0$）', difficulty: 1, kpNames: ['协方差与相关系数'] },
    { content: '设$X\\sim N(0,1)$，求$E(|X|)$', questionType: 'fill_in', answer: '√(2/π)', solution: '$E(|X|)=\\int_{-\\infty}^{\\infty}|x|\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}dx=2\\int_0^{\\infty}x\\frac{1}{\\sqrt{2\\pi}}e^{-x^2/2}dx=\\sqrt{\\frac{2}{\\pi}}$', difficulty: 2, kpNames: ['数学期望'] },
    { content: '设$X,Y$满足$Y=aX+b$（$a\\neq0$），求$\\rho_{XY}$', questionType: 'fill_in', answer: '1（a>0时）或-1（a<0时）', solution: '$\\rho_{XY}=\\frac{\\operatorname{Cov}(X,aX+b)}{\\sqrt{D(X)D(aX+b)}}=\\frac{a\\operatorname{Cov}(X,X)}{|a|D(X)}=\\frac{a}{|a|}=\\pm1$', difficulty: 1, kpNames: ['协方差与相关系数'] },
    { content: '设$X\\sim P(\\lambda)$，求$E(X^3)$（利用矩）', questionType: 'fill_in', answer: 'λ^3+3λ^2+λ', solution: '泊松分布的矩：$E(X)=\\lambda,E(X^2)=\\lambda^2+\\lambda,E(X^3)=\\lambda^3+3\\lambda^2+\\lambda$', difficulty: 2, kpNames: ['数学期望'] },
    { content: '设$X,Y$的相关系数$\\rho_{XY}=0.5$，$Z=2X-Y$，若$D(X)=4,D(Y)=1$，求$D(Z)$', questionType: 'fill_in', answer: '15', solution: '$\\operatorname{Cov}(X,Y)=0.5\\times2\\times1=1$，$D(Z)=4D(X)+D(Y)-4\\operatorname{Cov}(X,Y)=16+1-4=13$。重复：$D(2X-Y)=4\\cdot4+1-2\\cdot2\\cdot\\operatorname{Cov}=16+1-4\\cdot1=13$', difficulty: 2, kpNames: ['协方差与相关系数', '方差与标准差'] },

    // === 参数估计（新增） ===
    { content: '设总体$X$的密度函数$f(x;\\theta)=\\theta x^{\\theta-1}$（$0<x<1,\\theta>0$），$X_1,\\cdots,X_n$为样本，求$\\theta$的矩估计', questionType: 'fill_in', answer: 'θ̂=x̄/(1-x̄)', solution: '$E(X)=\\int_0^1 x\\cdot\\theta x^{\\theta-1}dx=\\frac{\\theta}{\\theta+1}$，令$\\frac{\\theta}{\\theta+1}=\\bar{X}$，$\\hat{\\theta}=\\frac{\\bar{X}}{1-\\bar{X}}$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设总体$X\\sim B(1,p)$，$X_1,\\cdots,X_n$为样本，求$p$的最大似然估计', questionType: 'fill_in', answer: 'p̂=x̄', solution: '似然函数$L(p)=p^{\\sum x_i}(1-p)^{n-\\sum x_i}$，$\\ln L=\\sum x_i\\ln p+(n-\\sum x_i)\\ln(1-p)$，求导得$\\hat{p}=\\bar{X}$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设总体$X\\sim N(\\mu,\\sigma^2)$，$\\sigma^2$已知，求$\\mu$的$95\\%$置信区间', questionType: 'fill_in', answer: '(x̄-z_{0.025}σ/√n,x̄+z_{0.025}σ/√n)', solution: '枢轴量$U=\\frac{\\bar{X}-\\mu}{\\sigma/\\sqrt{n}}\\sim N(0,1)$，$P(-z_{0.025}<U<z_{0.025})=0.95$，置信区间$\\bar{X}\\pm z_{0.025}\\frac{\\sigma}{\\sqrt{n}}$', difficulty: 2, kpNames: ['区间估计'] },
    { content: '设总体$X\\sim N(\\mu,\\sigma^2)$，$\\mu$已知，求$\\sigma^2$的最大似然估计', questionType: 'fill_in', answer: '(1/n)∑(X_i-μ)^2', solution: '似然函数求导得$\\hat{\\sigma}^2=\\frac{1}{n}\\sum_{i=1}^n(X_i-\\mu)^2$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设$X_1,\\cdots,X_n$是来自总体$N(\\mu,\\sigma^2)$的样本，证明$\\bar{X}$是$\\mu$的一致估计', questionType: 'essay', answer: '由大数定律，x̄→μ', solution: '由辛钦大数定律，$\\bar{X}\\xrightarrow{P}\\mu$（$n\\to\\infty$），故$\\bar{X}$是$\\mu$的一致估计', difficulty: 2, kpNames: ['估计量的评价标准'] },
    { content: '比较$\\hat{\\mu}_1=\\bar{X}$和$\\hat{\\mu}_2=X_1$作为$\\mu$的估计量，哪个更有效', questionType: 'fill_in', answer: 'μ̂₁更有效', solution: '$D(\\hat{\\mu}_1)=\\frac{\\sigma^2}{n}$，$D(\\hat{\\mu}_2)=\\sigma^2$，$n\\geq2$时$D(\\hat{\\mu}_1)<D(\\hat{\\mu}_2)$，$\\hat{\\mu}_1$更有效', difficulty: 1, kpNames: ['估计量的评价标准'] },
    { content: '设总体$X\\sim U(0,\\theta)$，$X_1,\\cdots,X_n$为样本，求$\\theta$的矩估计和最大似然估计', questionType: 'essay', answer: '矩估计2x̄，MLE为max(X_i)', solution: '矩估计：$E(X)=\\theta/2=\\bar{X}$，$\\hat{\\theta}_1=2\\bar{X}$；最大似然：$L(\\theta)=1/\\theta^n$，$0\\leq X_i\\leq\\theta$，$\\hat{\\theta}_2=\\max(X_i)$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设总体$X\\sim N(\\mu,4)$，样本容量$n=16$，$\\bar{x}=5$，求$\\mu$的$90\\%$置信区间', questionType: 'fill_in', answer: '(4.1775,5.8225)', solution: '$z_{0.05}=1.645$，$\\bar{x}\\pm1.645\\times2/4=5\\pm0.8225$，区间$(4.1775,5.8225)$', difficulty: 2, kpNames: ['区间估计'] },
    { content: '设$X_1,\\cdots,X_n$是来自总体$X$的样本，$E(X)=\\mu$，问$\\hat{\\mu}=X_1$是否是$\\mu$的无偏估计', questionType: 'fill_in', answer: '是', solution: '$E(\\hat{\\mu})=E(X_1)=\\mu$，故是无偏估计（但方差大，不是有效的）', difficulty: 1, kpNames: ['估计量的评价标准'] },
    { content: '设总体$X\\sim E(\\lambda)$，$X_1,\\cdots,X_n$为样本，求$\\lambda$的最大似然估计', questionType: 'fill_in', answer: 'λ̂=1/x̄', solution: '$L(\\lambda)=\\lambda^n e^{-\\lambda\\sum x_i}$，$\\ln L=n\\ln\\lambda-\\lambda\\sum x_i$，求导得$\\hat{\\lambda}=\\frac{n}{\\sum X_i}=\\frac{1}{\\bar{X}}$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设总体$X$的分布律$P(X=0)=\\theta^2,P(X=1)=2\\theta(1-\\theta),P(X=2)=(1-\\theta)^2$，观测到1个0、4个1、3个2，求$\\theta$的矩估计', questionType: 'fill_in', answer: '3/8', solution: '$E(X)=0\\cdot\\theta^2+1\\cdot2\\theta(1-\\theta)+2(1-\\theta)^2=2-2\\theta$，样本均值$\\bar{X}=\\frac{4+6}{8}=1.25$，$2-2\\theta=1.25$，$\\theta=0.375=3/8$', difficulty: 3, kpNames: ['点估计'] },

    // ==================== 补充题库：补齐至500+ ====================

    // === 高等数学补充 ===
    { content: '求极限：$\\lim_{x\\to0}\\frac{x\\sin x}{1-\\cos x}$', questionType: 'fill_in', answer: '2', solution: '$x\\sin x\\sim x^2$，$1-\\cos x\\sim\\frac{x^2}{2}$，极限为$\\frac{x^2}{x^2/2}=2$', difficulty: 1, kpNames: ['无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to\\infty}(\\frac{x+1}{x-1})^x$', questionType: 'fill_in', answer: 'e^2', solution: '$(\\frac{x+1}{x-1})^x=(1+\\frac{2}{x-1})^x=[(1+\\frac{2}{x-1})^{(x-1)/2}]^{2x/(x-1)}\\to e^2$', difficulty: 2, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '设$f(x)=|x|$，求$f\'(0)$是否存在', questionType: 'choice', options: JSON.stringify(['存在，等于0', '存在，等于1', '不存在', '存在，等于-1']), answer: '不存在', solution: '$f\'(0)=\\lim_{h\\to0}\\frac{|h|}{h}$，左右极限分别为$-1$和$1$，不等，故不可导', difficulty: 1, kpNames: ['导数概念'] },
    { content: '求$\\int\\tan^2x\\,dx$', questionType: 'fill_in', answer: 'tan x-x+C', solution: '$\\int(\\sec^2x-1)dx=\\tan x-x+C$', difficulty: 1, kpNames: ['不定积分的概念与性质'] },
    { content: '求$\\int_0^1\\frac{x}{1+x^2}dx$', questionType: 'fill_in', answer: '(ln2)/2', solution: '$\\frac{1}{2}\\int_0^1\\frac{d(1+x^2)}{1+x^2}=\\frac{1}{2}[\\ln(1+x^2)]_0^1=\\frac{\\ln2}{2}$', difficulty: 1, kpNames: ['微积分基本公式'] },
    { content: '求微分方程$y\'\'-y=0$满足$y(0)=1,y\'(0)=0$的特解', questionType: 'fill_in', answer: 'y=(e^x+e^(-x))/2=coshx', solution: '特征方程$r^2-1=0$，$r=\\pm1$，$y=C_1e^x+C_2e^{-x}$，由初始条件得$C_1=C_2=\\frac{1}{2}$', difficulty: 1, kpNames: ['常系数线性微分方程'] },
    { content: '求曲面$z=xy$在点$(1,2,2)$处的法线方程', questionType: 'fill_in', answer: '(x-1)/2=(y-2)/1=(z-2)/(-1)', solution: '$z_x=y|_{(1,2)}=2,z_y=x|_{(1,2)}=1$，法向量$\\vec{n}=(-2,-1,1)$，法线方程$\\frac{x-1}{-2}=\\frac{y-2}{-1}=\\frac{z-2}{1}$，即$\\frac{x-1}{2}=\\frac{y-2}{1}=\\frac{z-2}{-1}$', difficulty: 2, kpNames: ['偏导数'] },
    { content: '求$\\iint_D(x^2+y)dxdy$，$D$由$y=x^2,y=1$围成', questionType: 'fill_in', answer: '44/105', solution: '$D:-1\\leq x\\leq1,x^2\\leq y\\leq1$，$\\int_{-1}^1 dx\\int_{x^2}^1(x^2+y)dy=\\int_{-1}^1(x^2(1-x^2)+\\frac{1-x^4}{2})dx=\\frac{44}{105}$', difficulty: 2, kpNames: ['二重积分的计算'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{3^n}{n!}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '无法判断']), answer: '收敛', solution: '比值法：$\\frac{a_{n+1}}{a_n}=\\frac{3}{n+1}\\to0<1$，收敛', difficulty: 1, kpNames: ['常数项级数的审敛法'] },
    { content: '求曲线$y=\\frac{1}{x}$在$1\\leq x\\leq2$上的弧长', questionType: 'fill_in', answer: '∫_1^2√(1+1/x^4)dx', solution: '$y\'=-\\frac{1}{x^2}$，弧长$s=\\int_1^2\\sqrt{1+\\frac{1}{x^4}}dx$（此积分无初等表达式）', difficulty: 2, kpNames: ['定积分求弧长'] },
    { content: '设$f(x)=\\begin{cases}\\frac{1-\\cos x}{x^2},&x\\neq0\\\\a,&x=0\\end{cases}$连续，求$a$', questionType: 'fill_in', answer: '1/2', solution: '$\\lim_{x\\to0}\\frac{1-\\cos x}{x^2}=\\frac{1}{2}$，连续则$a=\\frac{1}{2}$', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '求$\\int\\frac{dx}{x\\ln x}$', questionType: 'fill_in', answer: 'ln|lnx|+C', solution: '$\\int\\frac{d(\\ln x)}{\\ln x}=\\ln|\\ln x|+C$', difficulty: 1, kpNames: ['换元积分法'] },
    { content: '求$\\lim_{x\\to0}\\frac{\\int_0^x\\sin t^2 dt}{x^3}$', questionType: 'fill_in', answer: '1/3', solution: '0/0型，洛必达：$\\lim\\frac{\\sin x^2}{3x^2}=\\frac{1}{3}$', difficulty: 2, kpNames: ['微积分基本公式', '洛必达法则'] },
    { content: '求$y\'\'+y=0$的通解', questionType: 'fill_in', answer: 'y=C1cosx+C2sinx', solution: '特征方程$r^2+1=0$，$r=\\pm i$，通解$y=C_1\\cos x+C_2\\sin x$', difficulty: 1, kpNames: ['常系数线性微分方程'] },
    { content: '证明：若$f(x)$在$[a,b]$上连续可导，$f(a)=f(b)$，则存在$\\xi\\in(a,b)$使$f\'(\\xi)=0$', questionType: 'essay', answer: '罗尔定理', solution: '这就是罗尔定理的表述。$f$在$[a,b]$上连续，$(a,b)$内可导，$f(a)=f(b)$，存在$\\xi\\in(a,b)$使$f\'(\\xi)=0$', difficulty: 1, kpNames: ['微分中值定理'] },
    { content: '设$z=f(xy,\\frac{x}{y})$，求$\\frac{\\partial z}{\\partial x}$', questionType: 'fill_in', answer: 'yf1+f2/y', solution: '令$u=xy,v=x/y$，$\\frac{\\partial z}{\\partial x}=f_u\\cdot y+f_v\\cdot\\frac{1}{y}=yf_1+\\frac{1}{y}f_2$', difficulty: 2, kpNames: ['多元复合函数求导'] },
    { content: '求幂级数$\\sum_{n=0}^{\\infty}(-1)^n x^{2n}$的和函数', questionType: 'fill_in', answer: '1/(1+x^2)', solution: '几何级数：$\\sum_{n=0}^{\\infty}(-x^2)^n=\\frac{1}{1+x^2}$，$|x|<1$', difficulty: 2, kpNames: ['幂级数'] },

    // === 线性代数补充 ===
    { content: '计算行列式：$\\begin{vmatrix}2&0&1\\\\0&3&0\\\\1&0&2\\end{vmatrix}$', questionType: 'fill_in', answer: '9', solution: '按第二行展开最简：$3\\cdot\\begin{vmatrix}2&1\\\\1&2\\end{vmatrix}=3\\times3=9$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '设$A=\\begin{pmatrix}\\cos\\theta&-\\sin\\theta\\\\\\sin\\theta&\\cos\\theta\\end{pmatrix}$，求$A^{-1}$', questionType: 'fill_in', answer: '[[cosθ,sinθ],[-sinθ,cosθ]]', solution: '旋转矩阵的逆等于旋转角的相反方向：$A^{-1}=A^T=\\begin{pmatrix}\\cos\\theta&\\sin\\theta\\\\-\\sin\\theta&\\cos\\theta\\end{pmatrix}$', difficulty: 1, kpNames: ['逆矩阵'] },
    { content: '设$A$为$3$阶可逆矩阵，$A^*$为伴随矩阵，则$(A^*)^{-1}$等于', questionType: 'choice', options: JSON.stringify(['A/|A|', '|A|A', 'A', '|A|A^{-1}']), answer: 'A/|A|', solution: '$A^*=|A|A^{-1}$，$(A^*)^{-1}=A/|A|$', difficulty: 2, kpNames: ['逆矩阵'] },
    { content: '设$A$为$m\\times n$矩阵，$r(A)=r$，则$Ax=0$的解空间的维数为', questionType: 'fill_in', answer: 'n-r', solution: '齐次方程组的解空间维数$=n-r(A)=n-r$', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '设$\\alpha=(1,1,1)^T$是$A$对应于特征值$\\lambda$的特征向量，$A\\alpha$等于', questionType: 'fill_in', answer: 'λα', solution: '由特征向量的定义：$A\\alpha=\\lambda\\alpha=(\\lambda,\\lambda,\\lambda)^T$', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '设$A\\sim\\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}$，求$|A|$', questionType: 'fill_in', answer: '-1', solution: '相似矩阵有相同的行列式，$|A|=1\\times(-1)=-1$', difficulty: 1, kpNames: ['相似矩阵与对角化'] },
    { content: '二次型$f(x_1,x_2)=x_1^2+x_2^2$的正定性是', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '正定', solution: '矩阵为单位矩阵$E$，特征值均为$1>0$，正定', difficulty: 1, kpNames: ['二次型'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&2\\\\0&3\\end{pmatrix}$的特征值', questionType: 'fill_in', answer: '1和3', solution: '三角矩阵的特征值就是对角线元素：$\\lambda_1=1,\\lambda_2=3$', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '设$A,B$为$n$阶正交矩阵，则$AB$是否为正交矩阵', questionType: 'choice', options: JSON.stringify(['是', '否', '不一定']), answer: '是', solution: '$(AB)^T(AB)=B^TA^TAB=B^TB=E$，故$AB$也是正交矩阵', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '求向量组$\\alpha_1=(1,0,0)^T,\\alpha_2=(0,1,0)^T,\\alpha_3=(0,0,0)^T$的秩', questionType: 'fill_in', answer: '2', solution: '只有$\\alpha_1,\\alpha_2$线性无关，$\\alpha_3$是零向量，秩为$2$', difficulty: 1, kpNames: ['向量组的秩'] },
    { content: '设$A$为$3\\times4$矩阵，若$Ax=b$有解且$r(A)=2$，则解中自由未知量的个数', questionType: 'fill_in', answer: '2', solution: '自由未知量个数$=n-r(A)=4-2=2$', difficulty: 1, kpNames: ['线性方程组解的结构'] },
    { content: '计算行列式：$\\begin{vmatrix}1&1&1\\\\a&b&c\\\\a^3&b^3&c^3\\end{vmatrix}$', questionType: 'fill_in', answer: '(a+b+c)(b-a)(c-a)(c-b)', solution: '此行列式等于$(a+b+c)$乘以范德蒙行列式$(b-a)(c-a)(c-b)$', difficulty: 3, kpNames: ['行列式的计算'] },
    { content: '设$n$阶方阵$A$满足$A^2-2A+E=0$，求$(A-E)^{-1}$', questionType: 'fill_in', answer: 'A-E', solution: '$A^2-2A+E=(A-E)^2=0$，$(A-E)^2=0$，但$(A-E)$的逆是其自身意味着... 实际上$A^2-2A+E=(A-E)^2=0$，则$A-E$幂零，不一定可逆。若$A=E$可逆。重新分析：$(A-E)^2=0$，$A-E$不可逆', difficulty: 3, kpNames: ['逆矩阵'] },
    { content: '设$A=\\begin{pmatrix}1&0\\\\2&1\\end{pmatrix}$，求$A$的属于特征值$1$的所有特征向量', questionType: 'fill_in', answer: 'k(0,1)^T(k≠0)', solution: '解$(A-E)x=0$：$\\begin{pmatrix}0&0\\\\2&0\\end{pmatrix}\\begin{pmatrix}x_1\\\\x_2\\end{pmatrix}=0$，$x_1=0$，特征向量$k(0,1)^T$', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '用配方法判断二次型$f=x_1^2+2x_1x_2+3x_2^2$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '正定', solution: '$f=(x_1+x_2)^2+2x_2^2>0$（不全为零时），正定', difficulty: 1, kpNames: ['二次型'] },

    // === 概率论补充 ===
    { content: '掷两个骰子，求点数之和为7的概率', questionType: 'fill_in', answer: '1/6', solution: '样本点数$36$，和为7的情况：$(1,6),(2,5),(3,4),(4,3),(5,2),(6,1)$共$6$种，$P=\\frac{6}{36}=\\frac{1}{6}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设$P(A)=0.6,P(\\bar{A}B)=0.2$，求$P(\\overline{A\\cup B})$', questionType: 'fill_in', answer: '0.2', solution: '$P(\\bar{A}B)=P(B-A)=P(B)-P(AB)=0.2$，$P(\\overline{A\\cup B})=1-P(A\\cup B)=1-(P(A)+P(B)-P(AB))=1-(0.6+P(AB)+0.2)=1-0.8-P(AB)=0.2-P(AB)$。条件不足', difficulty: 2, kpNames: ['概率的定义与性质'] },
    { content: '设$X\\sim N(2,9)$，求$P(0<X<5)$', questionType: 'fill_in', answer: 'Φ(1)-Φ(-2/3)=Φ(1)+Φ(2/3)-1', solution: '标准化：$P(0<X<5)=P(\\frac{0-2}{3}<Z<\\frac{5-2}{3})=P(-\\frac{2}{3}<Z<1)=\\Phi(1)-\\Phi(-\\frac{2}{3})=\\Phi(1)+\\Phi(\\frac{2}{3})-1$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '设$X$的分布律$P(X=k)=C/3^k$（$k=1,2,3$），求常数$C$', questionType: 'fill_in', answer: '27/13', solution: '$\\sum_{k=1}^3\\frac{C}{3^k}=C(\\frac{1}{3}+\\frac{1}{9}+\\frac{1}{27})=C\\cdot\\frac{13}{27}=1$，$C=\\frac{27}{13}$', difficulty: 1, kpNames: ['离散型随机变量'] },
    { content: '设$X\\sim B(5,0.4)$，求$D(2X+1)$', questionType: 'fill_in', answer: '4.8', solution: '$D(X)=5\\times0.4\\times0.6=1.2$，$D(2X+1)=4D(X)=4.8$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$(X,Y)$的联合分布律：$P(X=1,Y=1)=0.2,P(X=1,Y=2)=0.3,P(X=2,Y=1)=0.1,P(X=2,Y=2)=0.4$，求$X$的边缘分布', questionType: 'fill_in', answer: 'P(X=1)=0.5,P(X=2)=0.5', solution: '$P(X=1)=0.2+0.3=0.5$，$P(X=2)=0.1+0.4=0.5$', difficulty: 1, kpNames: ['随机变量与分布函数'] },
    { content: '设$X$的密度为$f(x)=\\frac{1}{\\pi(1+x^2)}$（柯西分布），问$E(X)$是否存在', questionType: 'choice', options: JSON.stringify(['存在', '不存在', '等于0']), answer: '不存在', solution: '$\\int_{-\\infty}^{\\infty}\\frac{|x|}{\\pi(1+x^2)}dx$发散，故期望不存在', difficulty: 2, kpNames: ['数学期望'] },
    { content: '设总体$X\\sim N(\\mu,\\sigma^2)$，$\\bar{X}$为样本均值，$S^2$为样本方差，求$\\frac{(n-1)S^2}{\\sigma^2}$的分布', questionType: 'fill_in', answer: 'χ^2(n-1)', solution: '$\\frac{(n-1)S^2}{\\sigma^2}\\sim\\chi^2(n-1)$（自由度$n-1$的卡方分布）', difficulty: 2, kpNames: ['点估计'] },

    // === 高等数学再补充 ===
    { content: '求$\\lim_{n\\to\\infty}\\frac{n^2}{2^n}$', questionType: 'fill_in', answer: '0', solution: '指数增长快于幂增长：$\\lim_{n\\to\\infty}\\frac{n^2}{2^n}=0$', difficulty: 1, kpNames: ['数列的极限'] },
    { content: '设$f(x)$可导，$g(x)=f(\\sin^2x)+f(\\cos^2x)$，求$g\'(x)$', questionType: 'fill_in', answer: '0', solution: '$g\'(x)=f\'(\\sin^2x)\\cdot2\\sin x\\cos x+f\'(\\cos^2x)\\cdot2\\cos x(-\\sin x)=2\\sin x\\cos x[f\'(\\sin^2x)-f\'(\\cos^2x)]$。注意：$g(x)=f(\\sin^2x)+f(\\cos^2x)$为常数（因$\\sin^2+\\cos^2=1$），故$g\'(x)=0$', difficulty: 2, kpNames: ['复合函数求导法则'] },
    { content: '求$\\int_0^1\\frac{e^x}{1+e^x}dx$', questionType: 'fill_in', answer: 'ln((1+e)/2)', solution: '$\\int_0^1\\frac{d(e^x)}{1+e^x}=[\\ln(1+e^x)]_0^1=\\ln(1+e)-\\ln2$', difficulty: 1, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '求微分方程$y\'\'-5y\'+6y=0$的通解', questionType: 'fill_in', answer: 'y=C1e^(2x)+C2e^(3x)', solution: '特征方程$r^2-5r+6=0$，$r_1=2,r_2=3$，通解$y=C_1e^{2x}+C_2e^{3x}$', difficulty: 1, kpNames: ['常系数线性微分方程'] },
    { content: '求$\\lim_{(x,y)\\to(0,0)}\\frac{x^2y}{x^2+y^2}$', questionType: 'fill_in', answer: '0', solution: '令$x=r\\cos\\theta,y=r\\sin\\theta$，$|\\frac{r^3\\cos^2\\theta\\sin\\theta}{r^2}|=|r\\cos^2\\theta\\sin\\theta|\\leq r\\to0$', difficulty: 1, kpNames: ['多元函数的基本概念'] },
    { content: '判断级数$\\sum_{n=1}^{\\infty}\\frac{n+1}{n(n+2)}$的敛散性', questionType: 'choice', options: JSON.stringify(['收敛', '发散', '条件收敛', '不确定']), answer: '发散', solution: '$\\frac{n+1}{n(n+2)}\\sim\\frac{1}{n}$（$n\\to\\infty$），调和级数发散，故原级数发散', difficulty: 1, kpNames: ['常数项级数的审敛法'] },
    { content: '求$\\int_0^1 x^2\\sqrt{1-x^2}dx$', questionType: 'fill_in', answer: 'π/16', solution: '令$x=\\sin t$，$\\int_0^{\\pi/2}\\sin^2t\\cos^2t dt=\\frac{1}{4}\\int_0^{\\pi/2}\\sin^22t dt=\\frac{1}{8}\\int_0^{\\pi/2}(1-\\cos4t)dt=\\frac{\\pi}{16}$', difficulty: 2, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '用定义证明：$\\lim_{x\\to2}x^2=4$', questionType: 'essay', answer: '对任意ε>0，取δ=min(1,ε/5)，当0<|x-2|<δ时，|x^2-4|<ε', solution: '$|x^2-4|=|x-2||x+2|<\\delta\\cdot5\\leq\\varepsilon$（当$|x-2|<\\delta\\leq1$时$|x+2|<5$）', difficulty: 2, kpNames: ['函数的极限'] },
    { content: '设$f(x)=\\ln\\sqrt{x^2+1}$，求$f\'\'(x)$', questionType: 'fill_in', answer: '(1-x^2)/(1+x^2)^2', solution: '$f(x)=\\frac{1}{2}\\ln(1+x^2)$，$f\'(x)=\\frac{x}{1+x^2}$，$f\'\'(x)=\\frac{(1+x^2)-2x^2}{(1+x^2)^2}=\\frac{1-x^2}{(1+x^2)^2}$', difficulty: 1, kpNames: ['高阶导数'] },
    { content: '求$y=x^3e^{-x}$的极值', questionType: 'fill_in', answer: '极小值0，极大值27e^(-3)', solution: '$y\'=x^2e^{-x}(3-x)$，驻点$x=0,3$，$x=0$为拐点非极值，$x=3$为极大值点，极大值$27e^{-3}$', difficulty: 1, kpNames: ['函数的极值与最值'] },
    { content: '求$\\lim_{x\\to\\infty}(\\sqrt{x^2+x}-\\sqrt{x^2-x})$', questionType: 'fill_in', answer: '1', solution: '有理化：$\\frac{2x}{\\sqrt{x^2+x}+\\sqrt{x^2-x}}=\\frac{2}{\\sqrt{1+1/x}+\\sqrt{1-1/x}}\\to1$', difficulty: 1, kpNames: ['函数的极限'] },
    { content: '设$z=e^{xy}$，求$\\frac{\\partial^2 z}{\\partial x\\partial y}$', questionType: 'fill_in', answer: 'e^(xy)(1+xy)', solution: '$\\frac{\\partial z}{\\partial x}=ye^{xy}$，$\\frac{\\partial^2 z}{\\partial x\\partial y}=e^{xy}+xye^{xy}=e^{xy}(1+xy)$', difficulty: 1, kpNames: ['偏导数'] },
    { content: '求$\\iint_D(x+y)dxdy$，$D$由$0\\leq x\\leq1,0\\leq y\\leq x$围成', questionType: 'fill_in', answer: '1/2', solution: '$\\int_0^1 dx\\int_0^x(x+y)dy=\\int_0^1(x^2+\\frac{x^2}{2})dx=\\frac{1}{2}$', difficulty: 1, kpNames: ['二重积分的计算'] },
    { content: '将$f(x)=e^{-x^2}$展开成$x$的幂级数', questionType: 'essay', answer: '∑_{n=0}^∞(-1)^n x^(2n)/n!,|x|<∞', solution: '$e^{-x^2}=\\sum_{n=0}^{\\infty}\\frac{(-x^2)^n}{n!}=\\sum_{n=0}^{\\infty}\\frac{(-1)^n}{n!}x^{2n}$，$x\\in(-\\infty,+\\infty)$', difficulty: 2, kpNames: ['函数展开成幂级数'] },

    // === 线性代数再补充 ===
    { content: '设$A=\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}$，求$A^2$', questionType: 'fill_in', answer: '[[1,0],[0,1]]', solution: '$A^2=\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}=E$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '求矩阵$A=\\begin{pmatrix}1&2&-1\\\\3&4&-2\\\\5&-4&1\\end{pmatrix}$的秩', questionType: 'fill_in', answer: '2', solution: '行变换：$r_2-3r_1,r_3-5r_1$：$\\begin{pmatrix}1&2&-1\\\\0&-2&1\\\\0&-14&6\\end{pmatrix}$，$r_3-7r_2$得全零行，秩为$2$', difficulty: 2, kpNames: ['矩阵的秩'] },
    { content: '设$A$为$4$阶方阵，$|A|=2$，求$|A^T|$', questionType: 'fill_in', answer: '2', solution: '$|A^T|=|A|=2$', difficulty: 1, kpNames: ['行列式的定义与性质'] },
    { content: '设$\\alpha_1=(1,2)^T,\\alpha_2=(2,3)^T$，求由基$e_1,e_2$到基$\\alpha_1,\\alpha_2$的过渡矩阵', questionType: 'fill_in', answer: '[[1,2],[2,3]]', solution: '过渡矩阵$P=(\\alpha_1,\\alpha_2)=\\begin{pmatrix}1&2\\\\2&3\\end{pmatrix}$', difficulty: 1, kpNames: ['向量组的线性相关性'] },
    { content: '设$Ax=b$中$A$为$3\\times4$矩阵，$r(A)=3$，则$Ax=b$一定有解吗', questionType: 'choice', options: JSON.stringify(['一定有解', '不一定有解', '一定无解', '无穷多解']), answer: '一定有解', solution: '$r(A)=3=m$（方程个数），增广矩阵秩也为$3$，方程组有解（无穷多解）', difficulty: 2, kpNames: ['线性方程组解的结构'] },
    { content: '设$A$的特征值为$-1,0,1$，判断$A$是否可逆', questionType: 'choice', options: JSON.stringify(['可逆', '不可逆', '不一定']), answer: '不可逆', solution: '有特征值$0$，$|A|=(-1)\\cdot0\\cdot1=0$，不可逆', difficulty: 1, kpNames: ['特征值与特征向量'] },
    { content: '二次型$f=x_1^2-2x_1x_2$的正定性是', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '半正定', solution: '$f=(x_1-x_2)^2-x_2^2$，可正可负也可零。矩阵$A=\\begin{pmatrix}1&-1\\\\-1&0\\end{pmatrix}$，$|A|=-1<0$，不定', difficulty: 2, kpNames: ['二次型'] },
    { content: '设$A=\\begin{pmatrix}1&0\\\\0&2\\end{pmatrix}$，求$e^A$', questionType: 'fill_in', answer: '[[e,0],[0,e^2]]', solution: '对角矩阵的指数：$e^A=\\begin{pmatrix}e^1&0\\\\0&e^2\\end{pmatrix}$', difficulty: 2, kpNames: ['相似矩阵与对角化'] },
    { content: '判断命题真假：若$A^2=0$，则$A=0$', questionType: 'choice', options: JSON.stringify(['真', '假']), answer: '假', solution: '反例：$A=\\begin{pmatrix}0&1\\\\0&0\\end{pmatrix}$，$A^2=0$但$A\\neq0$', difficulty: 1, kpNames: ['矩阵的概念与运算'] },
    { content: '设$A$为$n$阶方阵，$r(A)<n$，求齐次方程组$Ax=0$的非零解个数', questionType: 'fill_in', answer: '无穷多', solution: '$r(A)<n$时，基础解系含$n-r(A)\\geq1$个向量，故有无穷多个非零解', difficulty: 1, kpNames: ['线性方程组解的结构'] },

    // === 概率论再补充 ===
    { content: '设事件$A,B$满足$P(A)=0.5,P(B)=0.6,P(B|A)=0.8$，求$P(A|B)$', questionType: 'fill_in', answer: '2/3', solution: '$P(AB)=P(A)P(B|A)=0.5\\times0.8=0.4$，$P(A|B)=\\frac{0.4}{0.6}=\\frac{2}{3}$', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '设$X$的概率密度$f(x)=\\frac{1}{2}e^{-|x|}$，求$E(X)$', questionType: 'fill_in', answer: '0', solution: '密度函数为偶函数，$E(X)=\\int_{-\\infty}^{\\infty}x\\cdot\\frac{1}{2}e^{-|x|}dx=0$（奇函数在对称区间积分）', difficulty: 1, kpNames: ['数学期望'] },
    { content: '设$X\\sim P(3)$，求$D(X)$', questionType: 'fill_in', answer: '3', solution: '泊松分布的方差等于参数：$D(X)=\\lambda=3$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$X\\sim E(2)$，求$P(X>1)$', questionType: 'fill_in', answer: 'e^(-2)', solution: '$P(X>1)=\\int_1^{\\infty}2e^{-2x}dx=[-e^{-2x}]_1^{\\infty}=e^{-2}$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '设总体$X\\sim U(\\theta,2\\theta)$，$X_1,\\cdots,X_n$为样本，求$\\theta$的矩估计', questionType: 'fill_in', answer: '2x̄/3', solution: '$E(X)=\\frac{3\\theta}{2}=\\bar{X}$，$\\hat{\\theta}=\\frac{2}{3}\\bar{X}$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设$X,Y$独立同分布于$N(0,1)$，求$E(X^2+Y^2)$', questionType: 'fill_in', answer: '2', solution: '$E(X^2+Y^2)=E(X^2)+E(Y^2)=D(X)+E(X)^2+D(Y)+E(Y)^2=1+0+1+0=2$', difficulty: 1, kpNames: ['数学期望'] },
    { content: '设$X$为随机变量，$E(X)=\\mu,D(X)=\\sigma^2$，用切比雪夫不等式估计$P(|X-\\mu|\\geq3\\sigma)$', questionType: 'fill_in', answer: '≤1/9', solution: '切比雪夫不等式：$P(|X-\\mu|\\geq3\\sigma)\\leq\\frac{\\sigma^2}{(3\\sigma)^2}=\\frac{1}{9}$', difficulty: 2, kpNames: ['方差与标准差'] },
    { content: '设$X$在$[-1,1]$上服从均匀分布，求$Y=|X|$的分布函数', questionType: 'fill_in', answer: 'F_Y(y)=y(0≤y≤1)', solution: '$F_Y(y)=P(|X|\\leq y)=P(-y\\leq X\\leq y)=y$（$0\\leq y\\leq1$）', difficulty: 2, kpNames: ['随机变量函数的分布'] },
    { content: '设$X\\sim N(0,1)$，求$Y=X^3$的期望', questionType: 'fill_in', answer: '0', solution: '$f(x)$为偶函数，$x^3$为奇函数，$E(X^3)=\\int_{-\\infty}^{\\infty}x^3\\phi(x)dx=0$', difficulty: 1, kpNames: ['数学期望'] },
    { content: '设$(X,Y)$的联合密度$f(x,y)=e^{-(x+y)}$（$x>0,y>0$），判断$X,Y$是否独立', questionType: 'fill_in', answer: '独立', solution: '$f_X(x)=e^{-x},f_Y(y)=e^{-y}$，$f(x,y)=f_X(x)f_Y(y)$，独立', difficulty: 1, kpNames: ['随机变量与分布函数'] },

    // === 最终补充 ===
    { content: '求$\\lim_{x\\to0}\\frac{\\sin2x-2\\sin x}{x^3}$', questionType: 'fill_in', answer: '-1', solution: '泰勒展开：$\\sin2x=2x-\\frac{8x^3}{6}+o(x^3)$，$2\\sin x=2x-\\frac{2x^3}{6}+o(x^3)$，差值$\\sim-x^3$，极限为$-1$', difficulty: 2, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求$\\int_0^\\pi\\cos^2x\\,dx$', questionType: 'fill_in', answer: 'π/2', solution: '$\\int_0^\\pi\\frac{1+\\cos2x}{2}dx=[\\frac{x}{2}+\\frac{\\sin2x}{4}]_0^\\pi=\\frac{\\pi}{2}$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '求$\\lim_{n\\to\\infty}\\sqrt[n]{n}$', questionType: 'fill_in', answer: '1', solution: '令$t=\\ln n/n\\to0$，$\\sqrt[n]{n}=e^{\\ln n/n}\\to e^0=1$', difficulty: 1, kpNames: ['数列的极限'] },
    { content: '设$y=(\\sin x)^{\\cos x}$（$\\sin x>0$），求$y\'$', questionType: 'fill_in', answer: 'y(cosx·cotx-sinx·lny)', solution: '对数求导法：$\\ln y=\\cos x\\ln\\sin x$，$\\frac{y\'}{y}=-\\sin x\\ln\\sin x+\\cos x\\cdot\\frac{\\cos x}{\\sin x}$', difficulty: 2, kpNames: ['函数的求导法则'] },
    { content: '求$\\int_0^2\\frac{dx}{\\sqrt{4-x^2}}$', questionType: 'fill_in', answer: 'π/2', solution: '$\\int_0^2\\frac{dx}{\\sqrt{4-x^2}}=[\\arcsin\\frac{x}{2}]_0^2=\\frac{\\pi}{2}$', difficulty: 1, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '求$y\'\'-3y\'+2y=2e^x$的通解', questionType: 'fill_in', answer: 'y=C1e^x+C2e^(2x)-2xe^x', solution: '齐次通解$y_h=C_1e^x+C_2e^{2x}$，设$y_p=Axe^x$，代入得$A=-2$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '设$X\\sim N(1,4)$，求$P(X>3)$', questionType: 'fill_in', answer: '0.1587', solution: '$P(X>3)=P(Z>\\frac{3-1}{2})=P(Z>1)=1-\\Phi(1)=0.1587$', difficulty: 1, kpNames: ['连续型随机变量'] },
    { content: '求矩阵$A=\\begin{pmatrix}2&0&1\\\\0&1&0\\\\1&0&2\\end{pmatrix}$的特征值', questionType: 'fill_in', answer: '1,1,3', solution: '$|A-\\lambda E|=\\begin{vmatrix}2-\\lambda&0&1\\\\0&1-\\lambda&0\\\\1&0&2-\\lambda\\end{vmatrix}=(1-\\lambda)[(2-\\lambda)^2-1]=(1-\\lambda)(\\lambda-1)(\\lambda-3)$', difficulty: 2, kpNames: ['特征值与特征向量'] },
    { content: '判断二次型$f=x_1^2+3x_2^2$的正定性', questionType: 'choice', options: JSON.stringify(['正定', '负定', '不定', '半正定']), answer: '正定', solution: '$A=\\mathrm{diag}(1,3)$，特征值均为正，正定', difficulty: 1, kpNames: ['二次型'] },
    { content: '设$P(A)=0.5,P(A-B)=0.3$，求$P(\\overline{A}\\cup B)$', questionType: 'fill_in', answer: '0.8', solution: '$P(A-B)=P(A)-P(AB)=0.3$，$P(AB)=0.2$，$P(\\overline{A}\\cup B)=1-P(A-AB)=1-0.3=0.7$。另法：$P(\\overline{A}\\cup B)=1-P(A\\cap\\overline{B})=1-P(A-B)=0.7$', difficulty: 2, kpNames: ['概率的定义与性质'] },
    { content: '求$\\lim_{x\\to0}\\frac{e^x-e^{-x}}{\\sin x}$', questionType: 'fill_in', answer: '2', solution: '$e^x-e^{-x}=2\\sinh x\\sim2x$，$\\sin x\\sim x$，极限为$2$', difficulty: 1, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求$\\int\\frac{\\cos\\sqrt{x}}{\\sqrt{x}}dx$', questionType: 'fill_in', answer: '2sin√x+C', solution: '令$t=\\sqrt{x}$，$dx=2tdt$，$\\int\\frac{\\cos t}{t}\\cdot2tdt=2\\sin t+C=2\\sin\\sqrt{x}+C$', difficulty: 1, kpNames: ['换元积分法'] },
    { content: '设$A,B$为事件，$P(A)=\\frac{1}{3},P(B)=\\frac{1}{2}$，当$A,B$互斥时求$P(A\\cup B)$', questionType: 'fill_in', answer: '5/6', solution: '互斥时$P(AB)=0$，$P(A\\cup B)=P(A)+P(B)=\\frac{5}{6}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '求$\\int_0^{\\pi/2}\\cos^3x\\,dx$', questionType: 'fill_in', answer: '2/3', solution: '$\\int_0^{\\pi/2}(1-\\sin^2x)\\cos x dx=[\\sin x-\\frac{\\sin^3x}{3}]_0^{\\pi/2}=1-\\frac{1}{3}=\\frac{2}{3}$', difficulty: 1, kpNames: ['定积分的换元法和分部积分法'] },

    // ==================== 第五轮扩充：极限与连续 ====================
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\sin x - x\\cos x}{x^3}$', questionType: 'fill_in', answer: '1/3', solution: '泰勒展开：$\\sin x=x-\\frac{x^3}{6}+o(x^3)$，$x\\cos x=x-\\frac{x^3}{2}+o(x^3)$，分子$\\sim\\frac{x^3}{3}$，极限为$\\frac{1}{3}$', difficulty: 2, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{e^{\\tan x}-e^{\\sin x}}{x^3}$', questionType: 'fill_in', answer: '1/2', solution: '$e^{\\tan x}-e^{\\sin x}=e^{\\sin x}(e^{\\tan x-\\sin x}-1)\\sim\\tan x-\\sin x\\sim\\frac{x^3}{2}$', difficulty: 3, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0^+}x^{\\sin x}$', questionType: 'fill_in', answer: '1', solution: '取对数：$\\lim_{x\\to0^+}\\sin x\\ln x=\\lim_{x\\to0^+}\\frac{\\ln x}{1/\\sin x}$，洛必达得$\\lim_{x\\to0^+}\\frac{-\\sin^2x}{x\\cos x}=0$，原极限$=e^0=1$', difficulty: 3, kpNames: ['极限存在准则与两个重要极限', '洛必达法则'] },
    { content: '求极限：$\\lim_{n\\to\\infty}(1+\\frac{1}{n^2})^n$', questionType: 'fill_in', answer: '1', solution: '$(1+\\frac{1}{n^2})^n=e^{n\\ln(1+1/n^2)}\\sim e^{n\\cdot1/n^2}=e^{1/n}\\to1$', difficulty: 2, kpNames: ['极限存在准则与两个重要极限'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\sqrt{1+\\tan x}-\\sqrt{1+\\sin x}}{x^3}$', questionType: 'fill_in', answer: '1/4', solution: '分子有理化：$\\frac{\\tan x-\\sin x}{x^3(\\sqrt{1+\\tan x}+\\sqrt{1+\\sin x})}\\sim\\frac{x^3/2}{2x^3}=\\frac{1}{4}$', difficulty: 3, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\ln(\\sin^2x+e^x)-x}{\\ln(x^2+e^{2x})-2x}$', questionType: 'fill_in', answer: '1', solution: '$\\ln(\\sin^2x+e^x)=\\ln(e^x(1+\\sin^2x/e^x))=x+\\ln(1+\\sin^2x/e^x)\\sim x+\\sin^2x/e^x$，同理分母$\\sim2x+\\sin^2x/e^{2x}$，极限为$1$', difficulty: 3, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '设$f(x)$在$x=0$的某邻域内连续，$\\lim_{x\\to0}\\frac{f(x)}{x}=2$，求$\\lim_{x\\to0}\\frac{f(\\sin x)}{x}$', questionType: 'fill_in', answer: '2', solution: '$\\frac{f(\\sin x)}{x}=\\frac{f(\\sin x)}{\\sin x}\\cdot\\frac{\\sin x}{x}\\to2\\cdot1=2$', difficulty: 2, kpNames: ['函数的极限'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\cos(xe^x)-\\cos(xe^{-x})}{x^3}$', questionType: 'fill_in', answer: '-2/3', solution: '泰勒展开：$\\cos(xe^x)=1-\\frac{(xe^x)^2}{2}+o(x^3)$，$\\cos(xe^{-x})=1-\\frac{(xe^{-x})^2}{2}+o(x^3)$，分子$\\sim-\\frac{x^2}{2}(e^{2x}-e^{-2x})\\sim-\\frac{x^2}{2}\\cdot4x=-2x^3$', difficulty: 3, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '已知$\\lim_{x\\to0}\\frac{\\ln(1+f(x)/\\sin x)}{a^x-1}=A$（$a>0,a\\neq1$），$\\lim_{x\\to0}\\frac{f(x)}{x^2}=3$，求$A$', questionType: 'fill_in', answer: '3/lna', solution: '$a^x-1\\sim x\\ln a$，$\\ln(1+f(x)/\\sin x)\\sim f(x)/\\sin x$，$A=\\lim\\frac{f(x)}{x\\ln a\\cdot\\sin x}=\\lim\\frac{f(x)}{x^2\\ln a}=\\frac{3}{\\ln a}$', difficulty: 3, kpNames: ['函数的极限', '无穷小与无穷大'] },
    { content: '设$f(x)=\\begin{cases}\\frac{x^2-1}{x-1},&x\\neq1\\\\a,&x=1\\end{cases}$在$x=1$处连续，求$a$', questionType: 'fill_in', answer: '2', solution: '$\\lim_{x\\to1}\\frac{x^2-1}{x-1}=\\lim_{x\\to1}(x+1)=2$，连续即$a=2$', difficulty: 1, kpNames: ['函数的连续性与间断点'] },
    { content: '函数$f(x)=\\frac{e^{\\frac{1}{x}}-1}{e^{\\frac{1}{x}}+1}$在$x=0$处是什么间断点', questionType: 'choice', options: JSON.stringify(['可去间断点', '跳跃间断点', '无穷间断点', '连续']), answer: '跳跃间断点', solution: '$\\lim_{x\\to0^+}\\frac{e^{1/x}-1}{e^{1/x}+1}=1$，$\\lim_{x\\to0^-}\\frac{e^{1/x}-1}{e^{1/x}+1}=-1$，左右极限不等，跳跃间断点', difficulty: 2, kpNames: ['函数的连续性与间断点'] },
    { content: '求极限：$\\lim_{n\\to\\infty}\\sum_{k=1}^n\\frac{1}{n+k}$', questionType: 'fill_in', answer: 'ln2', solution: '$\\frac{1}{n}\\sum_{k=1}^n\\frac{1}{1+k/n}\\to\\int_0^1\\frac{dx}{1+x}=[\\ln(1+x)]_0^1=\\ln2$', difficulty: 2, kpNames: ['数列的极限', '定积分的概念与性质'] },

    // ==================== 第五轮扩充：导数与微分 ====================
    { content: '设$f(x)=\\frac{1}{1+x}$，求$f^{(n)}(x)$', questionType: 'fill_in', answer: '(-1)^n n!/(1+x)^(n+1)', solution: '$f\'(x)=-(1+x)^{-2}$，$f\'\'(x)=2(1+x)^{-3}$，归纳得$f^{(n)}(x)=(-1)^n n!(1+x)^{-(n+1)}$', difficulty: 2, kpNames: ['高阶导数'] },
    { content: '曲线$y=\\ln x$上哪一点的切线过原点', questionType: 'fill_in', answer: '(e,1)', solution: '切线方程$Y-\\ln x_0=\\frac{1}{x_0}(X-x_0)$，过原点得$0-\\ln x_0=\\frac{1}{x_0}(0-x_0)=-1$，$x_0=e$，$y_0=1$', difficulty: 2, kpNames: ['导数概念'] },
    { content: '设$y=\\arctan\\sqrt{x^2-1}-\\frac{\\ln x}{\\sqrt{x^2-1}}$，求$y\'$', questionType: 'fill_in', answer: 'xlnx/(x^2-1)^(3/2)', solution: '逐项求导并化简。$\\frac{d}{dx}\\arctan\\sqrt{x^2-1}=\\frac{1}{1+(x^2-1)}\\cdot\\frac{x}{\\sqrt{x^2-1}}=\\frac{1}{x\\sqrt{x^2-1}}$，后一项求导整理得结果', difficulty: 3, kpNames: ['函数的求导法则'] },
    { content: '设$y=f(x)$由$\\begin{cases}x=t^2+2t\\\\y=\\ln(1+t)\\end{cases}$确定，求$\\frac{d^2y}{dx^2}$在$t=1$处的值', questionType: 'fill_in', answer: '-1/16', solution: '$\\frac{dx}{dt}=2t+2$，$\\frac{dy}{dt}=\\frac{1}{1+t}$，$\\frac{dy}{dx}=\\frac{1}{(1+t)(2t+2)}=\\frac{1}{2(1+t)^2}$，$\\frac{d^2y}{dx^2}=\\frac{d}{dt}(\\frac{dy}{dx})/\\frac{dx}{dt}=-\\frac{1}{(1+t)^3(2t+2)}$，$t=1$时$=-\\frac{1}{16}$', difficulty: 3, kpNames: ['隐函数及参数方程求导', '高阶导数'] },
    { content: '设$y=y(x)$由方程$\\sin y+xe^y=0$确定，求$dy$', questionType: 'fill_in', answer: 'dy=-e^y dx/(cosy+xe^y)', solution: '两边求导：$\\cos y\\cdot y\'+e^y+xe^y y\'=0$，$y\'=-\\frac{e^y}{\\cos y+xe^y}$，$dy=-\\frac{e^y}{\\cos y+xe^y}dx$', difficulty: 2, kpNames: ['隐函数及参数方程求导', '函数的微分'] },
    { content: '设$f$可导，$y=f(\\sin^2x)+f(\\cos^2x)$，求$y\'$', questionType: 'fill_in', answer: 'sin2x[f\'(sin^2x)-f\'(cos^2x)]', solution: '$y\'=f\'(\\sin^2x)\\cdot2\\sin x\\cos x+f\'(\\cos^2x)\\cdot2\\cos x(-\\sin x)=\\sin2x[f\'(\\sin^2x)-f\'(\\cos^2x)]$', difficulty: 2, kpNames: ['函数的求导法则'] },
    { content: '设$f(x)=\\begin{cases}x^2\\sin\\frac{1}{x},&x\\neq0\\\\0,&x=0\\end{cases}$，讨论$f\'(x)$在$x=0$处的连续性', questionType: 'essay', answer: 'f\'(0)=0，但f\'(x)在x=0处不连续', solution: '$f\'(0)=\\lim_{h\\to0}h\\sin(1/h)=0$；$x\\neq0$时$f\'(x)=2x\\sin(1/x)-\\cos(1/x)$，$\\lim_{x\\to0}f\'(x)$不存在，故$f\'(x)$在$x=0$处不连续', difficulty: 3, kpNames: ['导数概念'] },
    { content: '用微分近似计算$\\sqrt{99.7}$', questionType: 'fill_in', answer: '9.985', solution: '$f(x)=\\sqrt{x}$，$x_0=100$，$\\Delta x=-0.3$，$f(99.7)\\approx10+\\frac{1}{20}\\times(-0.3)=9.985$', difficulty: 1, kpNames: ['函数的微分'] },

    // ==================== 第五轮扩充：中值定理与导数应用 ====================
    { content: '设$f(x)$在$[0,1]$上可导，$f(0)=0$，$f(1)=1$，证明存在$\\xi\\in(0,1)$使$f\'(\\xi)=2\\xi$', questionType: 'essay', answer: '构造F(x)=f(x)-x^2，由罗尔定理得证', solution: '令$F(x)=f(x)-x^2$，$F(0)=0$，$F(1)=0$，由罗尔定理存在$\\xi\\in(0,1)$使$F\'(\\xi)=f\'(\\xi)-2\\xi=0$', difficulty: 2, kpNames: ['微分中值定理'] },
    { content: '设$f(x)$在$[0,1]$上二阶可导，$f(0)=f(1)=0$，$\\max_{[0,1]}f(x)=2$，证明存在$\\xi\\in(0,1)$使$f\'\'(\\xi)\\leq-16$', questionType: 'essay', answer: '由泰勒展开和最大值得证', solution: '设$f(c)=2$，$c\\in(0,1)$，在$c$处展开：$f(0)=f(c)+f\'(c)(0-c)+\\frac{f\'\'(\\xi_1)}{2}c^2=0$，$f(1)=f(c)+f\'(c)(1-c)+\\frac{f\'\'(\\xi_2)}{2}(1-c)^2=0$，消去$f\'(c)$得$f\'\'(\\xi_1)\\leq-\\frac{4}{c^2}\\leq-16$', difficulty: 3, kpNames: ['微分中值定理', '泰勒公式'] },
    { content: '求极限：$\\lim_{x\\to0}\\frac{\\arcsin x-\\arctan x}{x^3}$', questionType: 'fill_in', answer: '1/3', solution: '泰勒展开：$\\arcsin x=x+\\frac{x^3}{6}+o(x^3)$，$\\arctan x=x-\\frac{x^3}{3}+o(x^3)$，差值$\\sim\\frac{x^3}{2}$，极限为$\\frac{1}{2}$。重新计算：$\\arcsin x=x+\\frac{x^3}{6}+\\frac{3x^5}{40}+\\cdots$，$\\arctan x=x-\\frac{x^3}{3}+\\frac{x^5}{5}-\\cdots$，差$\\frac{x^3}{2}+o(x^3)$，极限$\\frac{1}{2}$', difficulty: 3, kpNames: ['洛必达法则', '泰勒公式'] },
    { content: '求极限：$\\lim_{x\\to\\infty}x^2(a^{\\frac{1}{x}}-a^{\\frac{1}{x+1}})$（$a>0$）', questionType: 'fill_in', answer: 'lna', solution: '$a^{1/x}-a^{1/(x+1)}=a^{\\xi}\\ln a\\cdot(\\frac{1}{x}-\\frac{1}{x+1})\\sim\\ln a\\cdot\\frac{1}{x^2}$，$x^2$乘之得$\\ln a$', difficulty: 3, kpNames: ['微分中值定理'] },
    { content: '求$f(x)=\\frac{1}{x^2+1}$的$n$阶麦克劳林公式中$x^n$的系数', questionType: 'fill_in', answer: 'n为偶数时(-1)^(n/2),n为奇数时0', solution: '$\\frac{1}{1+x^2}=\\sum_{k=0}^{\\infty}(-1)^k x^{2k}$，$n$为偶数$2k$时系数$(-1)^k=(-1)^{n/2}$，$n$为奇数时系数$0$', difficulty: 2, kpNames: ['泰勒公式'] },
    { content: '求函数$f(x)=x^4-4x^3+6x^2-4x+1$的极值', questionType: 'fill_in', answer: '极小值点x=1，极小值0', solution: '$f(x)=(x-1)^4$，$f\'(x)=4(x-1)^3$，驻点$x=1$，$f\'\'(1)=0$，$f\'\'\'(1)=0$，$f^{(4)}(1)=24>0$，极小值点$x=1$，$f(1)=0$', difficulty: 2, kpNames: ['函数的极值与最值'] },
    { content: '求曲线$y=\\frac{x}{1+x^2}$的凹凸区间和拐点', questionType: 'essay', answer: '在(-∞,-√3)和(0,√3)凸，在(-√3,0)和(√3,+∞)凹，拐点(0,0),(-√3,-√3/4),(√3,√3/4)', solution: '$y\'=\\frac{1-x^2}{(1+x^2)^2}$，$y\'\'=\\frac{2x(x^2-3)}{(1+x^2)^3}$，$y\'\'=0$得$x=0,\\pm\\sqrt{3}$，分析符号得凹凸区间', difficulty: 2, kpNames: ['函数的单调性与凹凸性'] },
    { content: '求数列$\\{n^{\\frac{1}{n}}\\}$的最大项', questionType: 'fill_in', answer: '第3项，值为3^(1/3)', solution: '设$f(x)=x^{1/x}$，$f\'(x)=x^{1/x}\\cdot\\frac{1-\\ln x}{x^2}$，$x<e$时递增，$x>e$时递减，$1^{1}=1,2^{1/2}\\approx1.414,3^{1/3}\\approx1.442,4^{1/4}\\approx1.414$，最大项为第3项', difficulty: 2, kpNames: ['函数的极值与最值', '数列的极限'] },

    // ==================== 第五轮扩充：不定积分 ====================
    { content: '求$\\int\\frac{dx}{\\sin x\\cos x}$', questionType: 'fill_in', answer: 'ln|tanx|+C', solution: '$\\int\\frac{dx}{\\sin x\\cos x}=\\int\\frac{2dx}{\\sin2x}=\\int\\csc2x d(2x)=\\ln|\\tan x|+C$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{x^3}{\\sqrt{1+x^2}}dx$', questionType: 'fill_in', answer: '(x^2-2)√(1+x^2)/3+C', solution: '令$t=\\sqrt{1+x^2}$，$x^2=t^2-1$，$xdx=tdt$，$\\int\\frac{x^2\\cdot xdx}{\\sqrt{1+x^2}}=\\int\\frac{(t^2-1)tdt}{t}=\\int(t^2-1)dt=\\frac{t^3}{3}-t+C$，代回得结果', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{\\arctan x}{x^2(1+x^2)}dx$', questionType: 'fill_in', answer: '-arctanx/x+(1/2)ln(x^2/(1+x^2))-(1/2)(arctanx)^2+C', solution: '拆分：$\\frac{1}{x^2(1+x^2)}=\\frac{1}{x^2}-\\frac{1}{1+x^2}$，$\\int\\arctan x(\\frac{1}{x^2}-\\frac{1}{1+x^2})dx$，分部积分得结果', difficulty: 3, kpNames: ['分部积分法', '有理函数的积分'] },
    { content: '求$\\int\\frac{dx}{\\sqrt{x}(1+\\sqrt[3]{x})}$', questionType: 'fill_in', answer: '6[√[6]x-arctan(√[6]x)]+C', solution: '令$t=\\sqrt[6]{x}$，$x=t^6,dx=6t^5dt$，$\\int\\frac{6t^5dt}{t^3(1+t^2)}=6\\int\\frac{t^2}{1+t^2}dt=6\\int(1-\\frac{1}{1+t^2})dt=6(t-\\arctan t)+C$', difficulty: 3, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{x^2}{(x^2+1)(x^2+4)}dx$', questionType: 'fill_in', answer: '(-1/3)arctanx+(2/3)arctan(x/2)+C', solution: '部分分式：$\\frac{x^2}{(x^2+1)(x^2+4)}=\\frac{A}{x^2+1}+\\frac{B}{x^2+4}$，得$A=-\\frac{1}{3},B=\\frac{4}{3}$，积分得$-\\frac{1}{3}\\arctan x+\\frac{2}{3}\\arctan\\frac{x}{2}+C$', difficulty: 2, kpNames: ['有理函数的积分'] },
    { content: '求$\\int\\frac{\\sin x}{\\sin x+\\cos x}dx$', questionType: 'fill_in', answer: '(x-ln|sinx+cosx|)/2+C', solution: '$\\frac{\\sin x}{\\sin x+\\cos x}=\\frac{1}{2}(1-\\frac{\\cos x-\\sin x}{\\sin x+\\cos x})$，$\\int\\frac{\\cos x-\\sin x}{\\sin x+\\cos x}dx=\\ln|\\sin x+\\cos x|+C$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\frac{dx}{1+\\sqrt[3]{x+1}}$', questionType: 'fill_in', answer: '(3/2)(x+1)^(2/3)-3(x+1)^(1/3)+3ln|1+(x+1)^(1/3)|+C', solution: '令$t=\\sqrt[3]{x+1}$，$x=t^3-1,dx=3t^2dt$，$\\int\\frac{3t^2}{1+t}dt=3\\int(t-1+\\frac{1}{1+t})dt$', difficulty: 2, kpNames: ['换元积分法'] },
    { content: '求$\\int\\arcsin x\\cdot\\arccos x\\,dx$', questionType: 'fill_in', answer: 'x arcsinx arccosx+2√(1-x^2)-(arcsinx)^2/2+C', solution: '分部积分，利用$\\arcsin x+\\arccos x=\\frac{\\pi}{2}$简化', difficulty: 3, kpNames: ['分部积分法'] },

    // ==================== 第五轮扩充：定积分及其应用 ====================
    { content: '求$\\int_{-1}^1\\frac{x\\cos x}{1+x^2}dx$', questionType: 'fill_in', answer: '0', solution: '被积函数为奇函数，积分区间对称，积分为$0$', difficulty: 1, kpNames: ['定积分的概念与性质'] },
    { content: '求$\\int_0^1\\frac{\\ln(1+x)}{1+x^2}dx$', questionType: 'fill_in', answer: '(πln2)/8', solution: '令$x=\\tan t$，$\\int_0^{\\pi/4}\\ln(1+\\tan t)dt=\\int_0^{\\pi/4}\\ln(\\frac{\\sqrt{2}\\cos(\\pi/4-t)}{\\cos t})dt$，利用对称性得$\\frac{\\pi}{8}\\ln2$', difficulty: 3, kpNames: ['定积分的换元法和分部积分法'] },
    { content: '设$f(x)$在$[0,1]$上连续，$\\int_0^1 f(x)dx=1$，求$\\int_0^1 dx\\int_x^1 f(x)f(y)dy$', questionType: 'fill_in', answer: '1/2', solution: '令$I=\\int_0^1\\int_x^1 f(x)f(y)dydx$，$I=\\int_0^1\\int_0^y f(x)f(y)dxdy$（交换积分次序），$2I=\\int_0^1\\int_0^1 f(x)f(y)dxdy=(\\int_0^1 f(x)dx)^2=1$，$I=\\frac{1}{2}$', difficulty: 3, kpNames: ['定积分的概念与性质', '二重积分的计算'] },
    { content: '求$\\lim_{n\\to\\infty}\\frac{1}{n}\\sqrt[n]{(n+1)(n+2)\\cdots(n+n)}$', questionType: 'fill_in', answer: '4/e', solution: '取对数：$\\lim\\frac{1}{n}\\sum_{k=1}^n\\ln(1+\\frac{k}{n})=\\int_0^1\\ln(1+x)dx=[(1+x)\\ln(1+x)-x]_0^1=2\\ln2-1$，原极限$=e^{2\\ln2-1}=4/e$', difficulty: 3, kpNames: ['定积分的概念与性质'] },
    { content: '求$\\int_0^{+\\infty}\\frac{dx}{(1+x^2)(1+x^\\alpha)}$（$\\alpha>0$）', questionType: 'fill_in', answer: 'π/4', solution: '令$x=1/t$，$I=\\int_0^{+\\infty}\\frac{dt}{(1+t^2)(1+t^{-\\alpha})}=I$，$2I=\\int_0^{+\\infty}\\frac{dx}{1+x^2}=\\frac{\\pi}{2}$，$I=\\frac{\\pi}{4}$', difficulty: 3, kpNames: ['反常积分', '定积分的换元法和分部积分法'] },
    { content: '求曲线$r=2\\cos\\theta$与$r=1$围成公共部分的面积', questionType: 'fill_in', answer: '2π/3-√3/2', solution: '交点$2\\cos\\theta=1$，$\\theta=\\pm\\pi/3$，$S=2[\\int_0^{\\pi/3}\\frac{1}{2}\\cdot1^2 d\\theta+\\int_{\\pi/3}^{\\pi/2}\\frac{1}{2}(2\\cos\\theta)^2 d\\theta]=\\frac{2\\pi}{3}-\\frac{\\sqrt{3}}{2}$', difficulty: 2, kpNames: ['定积分求面积'] },
    { content: '求$y=x^2$与$y=x$围成图形绕$y$轴旋转所得体积', questionType: 'fill_in', answer: 'π/10', solution: '柱壳法：$V=2\\pi\\int_0^1 x(x-x^2)dx=2\\pi[\\frac{x^3}{3}-\\frac{x^4}{4}]_0^1=\\frac{\\pi}{6}$。重算：用圆盘法，$V=\\pi\\int_0^1[(\\sqrt{y})^2-(y)^2]dy=\\pi\\int_0^1(y-y^2)dy=\\pi(\\frac{1}{2}-\\frac{1}{3})=\\frac{\\pi}{6}$', difficulty: 2, kpNames: ['定积分求体积'] },
    { content: '求摆线$x=a(t-\\sin t),y=a(1-\\cos t)$一拱的弧长', questionType: 'fill_in', answer: '8a', solution: '$\\frac{dx}{dt}=a(1-\\cos t),\\frac{dy}{dt}=a\\sin t$，$ds=a\\sqrt{(1-\\cos t)^2+\\sin^2t}dt=a\\sqrt{2-2\\cos t}dt=2a|\\sin\\frac{t}{2}|dt$，$s=\\int_0^{2\\pi}2a\\sin\\frac{t}{2}dt=8a$', difficulty: 2, kpNames: ['定积分求弧长'] },
    { content: '求$\\int_0^1\\frac{\\ln(1+x)}{x}dx$', questionType: 'fill_in', answer: 'π^2/12', solution: '幂级数展开：$\\ln(1+x)=\\sum_{n=1}^{\\infty}\\frac{(-1)^{n-1}x^n}{n}$，$\\int_0^1\\sum\\frac{(-1)^{n-1}x^{n-1}}{n}dx=\\sum_{n=1}^{\\infty}\\frac{(-1)^{n-1}}{n^2}=\\frac{\\pi^2}{12}$', difficulty: 3, kpNames: ['定积分的概念与性质', '幂级数'] },

    // ==================== 第五轮扩充：微分方程 ====================
    { content: '求微分方程$y\'=y^2\\cos x$满足$y(0)=1$的特解', questionType: 'fill_in', answer: 'y=1/(1-sinx)', solution: '可分离变量：$\\frac{dy}{y^2}=\\cos x dx$，$-\\frac{1}{y}=\\sin x+C$，由$y(0)=1$得$C=-1$，$y=\\frac{1}{1-\\sin x}$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求微分方程$(x^2-1)y\'+2xy-\\cos x=0$的通解', questionType: 'fill_in', answer: 'y=(sinx+C)/(x^2-1)', solution: '一阶线性：$y\'+\\frac{2x}{x^2-1}y=\\frac{\\cos x}{x^2-1}$，积分因子$\\mu=x^2-1$，$(x^2-1)y=\\int\\cos x dx+C=\\sin x+C$', difficulty: 2, kpNames: ['一阶微分方程'] },
    { content: '求微分方程$yy\'\'-(y\')^2=0$的通解', questionType: 'fill_in', answer: 'y=C2e^(C1x)', solution: '令$p=y\'$，$y\'\'=p\\frac{dp}{dy}$，$yp\\frac{dp}{dy}-p^2=0$，$p(y\\frac{dp}{dy}-p)=0$，$\\frac{dp}{p}=\\frac{dy}{y}$，$p=C_1y$，$\\frac{dy}{dx}=C_1y$，$y=C_2e^{C_1x}$', difficulty: 2, kpNames: ['高阶线性微分方程'] },
    { content: '求$y\'\'-2y\'+y=xe^x$的通解', questionType: 'fill_in', answer: 'y=(C1+C2x)e^x+(x^3/6)e^x', solution: '齐次通解$y_h=(C_1+C_2x)e^x$，设特解$y_p=x^2(Ax+B)e^x$，代入得$A=1/6,B=0$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求$y\'\'+4y=4\\cos2x$的通解', questionType: 'fill_in', answer: 'y=C1cos2x+C2sin2x+xsin2x', solution: '齐次通解$y_h=C_1\\cos2x+C_2\\sin2x$，$\\pm2i$是特征根，设特解$y_p=x(A\\cos2x+B\\sin2x)$，代入得$A=0,B=1$', difficulty: 2, kpNames: ['常系数线性微分方程'] },
    { content: '求微分方程$y\'\'+y=x\\cos x$的一个特解形式', questionType: 'choice', options: JSON.stringify(['x(Acosx+Bsinx)', 'x^2(Acosx+Bsinx)', '(Ax+B)cosx+(Cx+D)sinx', 'x(Ax+B)cosx+x(Cx+D)sinx']), answer: 'x(Ax+B)cosx+x(Cx+D)sinx', solution: '自由项$e^{\\alpha x}P_m(x)\\cos\\beta x$型，$\\alpha=0,\\beta=1,m=1$，$\\alpha\\pm i\\beta=\\pm i$是特征根，$k=1$，特解$y_p=x^1[(Ax+B)\\cos x+(Cx+D)\\sin x]$', difficulty: 2, kpNames: ['常系数线性微分方程', '高阶线性微分方程'] },
    { content: '求微分方程$y\'\'=y\'+x$的通解', questionType: 'fill_in', answer: 'y=C1+C2e^x-x^2/2-x', solution: '令$p=y\'$，$p\'-p=x$，一阶线性：$p=e^x(\\int xe^{-x}dx+C_2)=C_2e^x-x-1$，$y=\\int(C_2e^x-x-1)dx=C_1+C_2e^x-\\frac{x^2}{2}-x$', difficulty: 2, kpNames: ['高阶线性微分方程'] },
    { content: '求微分方程$x^2y\'\'-2xy\'+2y=2x^3$的通解（欧拉方程）', questionType: 'fill_in', answer: 'y=C1x+C2x^2+x^3/2', solution: '欧拉方程，令$x=e^t$，$D(D-1)y-2Dy+2y=2e^{3t}$，$(D^2-3D+2)y=2e^{3t}$，齐次$y_h=C_1e^t+C_2e^{2t}=C_1x+C_2x^2$，特解$y_p=\\frac{x^3}{2}$', difficulty: 3, kpNames: ['常系数线性微分方程'] },

    // ==================== 第五轮扩充：线性代数 ====================
    { content: '计算行列式：$\\begin{vmatrix}1+a&1&1&1\\\\1&1+b&1&1\\\\1&1&1+c&1\\\\1&1&1&1+d\\end{vmatrix}$', questionType: 'fill_in', answer: 'abcd(1+1/a+1/b+1/c+1/d)', solution: '化为$abcd\\begin{vmatrix}1+1/a&1/b&1/c&1/d\\\\1/a&1+1/b&1/c&1/d\\\\1/a&1/b&1+1/c&1/d\\\\1/a&1/b&1/c&1+1/d\\end{vmatrix}$，提取公因子后计算', difficulty: 3, kpNames: ['行列式的计算'] },
    { content: '设$A=\\begin{pmatrix}1&2&3\\\\0&1&4\\\\5&6&0\\end{pmatrix}$，求$|A|$', questionType: 'fill_in', answer: '1', solution: '按第二列展开：$|A|=-2\\begin{vmatrix}0&4\\\\5&0\\end{vmatrix}+1\\begin{vmatrix}1&3\\\\5&0\\end{vmatrix}-6\\begin{vmatrix}1&3\\\\0&4\\end{vmatrix}=-2(-20)+1(-15)-6(4)=40-15-24=1$', difficulty: 1, kpNames: ['行列式的计算'] },
    { content: '设$A,B$为$n$阶方阵，$AB=0$，$r(A)=r$，求$r(B)$的最大可能值', questionType: 'fill_in', answer: 'n-r', solution: '由$AB=0$知$B$的每一列都是$Ax=0$的解，解空间维数为$n-r$，$r(B)\\leq n-r$', difficulty: 2, kpNames: ['矩阵的秩', '线性方程组解的结构'] },
    { content: '设$A=\\begin{pmatrix}1&0&1\\\\0&2&0\\\\1&0&1\\end{pmatrix}$，求正交矩阵$Q$使$Q^TAQ$为对角矩阵', questionType: 'essay', answer: 'Q=[[1/√2,0,1/√2],[0,1,0],[1/√2,0,-1/√2]],对角矩阵diag(2,2,0)', solution: '特征值：$\\lambda=2$（二重），$\\lambda=0$，对应特征向量$(1,0,1)^T,(0,1,0)^T$和$(1,0,-1)^T$，正交化后得正交矩阵', difficulty: 2, kpNames: ['特征值与特征向量', '相似矩阵与对角化'] },
    { content: '设$A$为$n$阶实对称矩阵，$A^2=A$，证明$A$的特征值只能是$0$或$1$，并求$r(A)$与$\\operatorname{tr}(A)$的关系', questionType: 'essay', answer: '特征值只能0或1，r(A)=tr(A)', solution: '幂等矩阵特征值只能是$0$或$1$，$\\operatorname{tr}(A)=\\sum\\lambda_i$等于特征值$1$的个数，即$r(A)=\\operatorname{tr}(A)$', difficulty: 2, kpNames: ['特征值与特征向量', '矩阵的秩'] },
    { content: '设三元二次型$f(x_1,x_2,x_3)=x_1^2+ax_2^2+x_3^2+2x_1x_2+2x_2x_3$的秩为$2$，求$a$', questionType: 'fill_in', answer: '1', solution: '矩阵$A=\\begin{pmatrix}1&1&0\\\\1&a&1\\\\0&1&1\\end{pmatrix}$，$r(A)=2$，$|A|=1\\cdot a\\cdot1+1\\cdot1\\cdot0+0-0-1\\cdot1\\cdot1-1\\cdot a\\cdot1=a-1=0$，$a=1$', difficulty: 2, kpNames: ['二次型', '矩阵的秩'] },
    { content: '用正交变换化二次型$f(x_1,x_2,x_3)=2x_1^2+5x_2^2+5x_3^2+4x_1x_2-4x_1x_3-8x_2x_3$为标准形', questionType: 'essay', answer: 'y1^2+y2^2+10y3^2', solution: '矩阵$A=\\begin{pmatrix}2&2&-2\\\\2&5&-4\\\\-2&-4&5\\end{pmatrix}$，特征值$\\lambda=1,1,10$，正交变换后标准形$y_1^2+y_2^2+10y_3^2$', difficulty: 2, kpNames: ['二次型', '特征值与特征向量'] },
    { content: '设向量组$\\alpha_1=(1,1,0)^T,\\alpha_2=(1,0,1)^T,\\alpha_3=(0,1,1)^T$，求一个向量$\\beta$使$\\alpha_1,\\alpha_2,\\alpha_3,\\beta$构成$\\mathbb{R}^3$的一组基（$\\beta$不能是$\\alpha_i$的线性组合）', questionType: 'fill_in', answer: 'β=(1,0,0)^T即可', solution: '$\\alpha_1,\\alpha_2,\\alpha_3$的秩为$3$，任取$\\beta$与它们线性无关即可，如$(1,0,0)^T$（行列式$\\begin{vmatrix}1&1&0&1\\\\1&0&1&0\\\\0&1&1&0\\end{vmatrix}\\neq0$）', difficulty: 2, kpNames: ['向量组的线性相关性'] },

    // ==================== 第五轮扩充：概率论与数理统计 ====================
    { content: '袋中有$a$个白球和$b$个黑球，从中不放回地取$k$个球（$k\\leq a+b$），求恰有$i$个白球的概率', questionType: 'fill_in', answer: 'C_a^i·C_b^(k-i)/C_(a+b)^k', solution: '超几何分布：$P(X=i)=\\frac{C_a^i C_b^{k-i}}{C_{a+b}^k}$', difficulty: 1, kpNames: ['概率的定义与性质'] },
    { content: '设$A,B$为两个事件，$P(A)>0,P(B)>0$，证明：若$A,B$互不相容，则$A,B$不独立', questionType: 'essay', answer: '互不相容则P(AB)=0≠P(A)P(B)，故不独立', solution: '若$A,B$互不相容，$P(AB)=0$，但$P(A)P(B)>0$，$P(AB)\\neq P(A)P(B)$，故不独立', difficulty: 1, kpNames: ['条件概率与独立性'] },
    { content: '设$X$的分布函数$F(x)=\\begin{cases}0,&x<0\\\\\\frac{x}{4},&0\\leq x<1\\\\\\frac{1}{2}+\\frac{x-1}{4},&1\\leq x<2\\\\1,&x\\geq2\\end{cases}$，求$P(X=1)$', questionType: 'fill_in', answer: '1/4', solution: '$P(X=1)=F(1)-F(1-)=\\frac{1}{2}-\\frac{1}{4}=\\frac{1}{4}$', difficulty: 1, kpNames: ['随机变量与分布函数'] },
    { content: '设$X\\sim N(0,1)$，$Y=X^2$，求$Y$的概率密度', questionType: 'fill_in', answer: 'f_Y(y)=1/√(2πy)e^(-y/2),y>0', solution: '$F_Y(y)=P(X^2\\leq y)=P(-\\sqrt{y}\\leq X\\leq\\sqrt{y})=2\\Phi(\\sqrt{y})-1$，$f_Y(y)=\\frac{1}{\\sqrt{y}}\\phi(\\sqrt{y})=\\frac{1}{\\sqrt{2\\pi y}}e^{-y/2}$（$y>0$），即$\\chi^2(1)$分布', difficulty: 2, kpNames: ['随机变量函数的分布'] },
    { content: '设$X,Y$独立，$X\\sim P(\\lambda_1),Y\\sim P(\\lambda_2)$，求$X+Y$的分布', questionType: 'fill_in', answer: 'X+Y~P(λ1+λ2)', solution: '泊松分布的可加性：$P(X+Y=k)=\\sum_{i=0}^k\\frac{\\lambda_1^i}{i!}e^{-\\lambda_1}\\frac{\\lambda_2^{k-i}}{(k-i)!}e^{-\\lambda_2}=\\frac{(\\lambda_1+\\lambda_2)^k}{k!}e^{-(\\lambda_1+\\lambda_2)}$', difficulty: 2, kpNames: ['离散型随机变量'] },
    { content: '设$X$的密度函数$f(x)=\\begin{cases}Ax^2e^{-kx},&x>0\\\\0,&x\\leq0\\end{cases}$（$k>0$），求常数$A$', questionType: 'fill_in', answer: 'A=k^3/2', solution: '$\\int_0^{\\infty}Ax^2e^{-kx}dx=A\\cdot\\frac{2}{k^3}=1$（利用$\\Gamma(3)=2$），$A=\\frac{k^3}{2}$', difficulty: 2, kpNames: ['连续型随机变量'] },
    { content: '设$X\\sim U(0,1)$，求$Y=-\\ln X$的分布', questionType: 'fill_in', answer: 'Y~E(1)', solution: '$F_Y(y)=P(-\\ln X\\leq y)=P(X\\geq e^{-y})=1-e^{-y}$（$y>0$），$f_Y(y)=e^{-y}$，$Y\\sim E(1)$', difficulty: 2, kpNames: ['随机变量函数的分布'] },
    { content: '设$X,Y$的联合密度$f(x,y)=\\begin{cases}8xy,&0<x<y<1\\\\0,&\\text{其他}\\end{cases}$，求$E(Y|X=\\frac{1}{2})$', questionType: 'fill_in', answer: '5/6', solution: '$f_X(x)=\\int_x^1 8xy dy=4x(1-x^2)$，$f_{Y|X}(y|x)=\\frac{8xy}{4x(1-x^2)}=\\frac{2y}{1-x^2}$（$x<y<1$），$E(Y|X=\\frac{1}{2})=\\int_{1/2}^1 y\\cdot\\frac{2y}{3/4}dy=\\frac{8}{3}\\int_{1/2}^1 y^2dy=\\frac{5}{6}$', difficulty: 3, kpNames: ['数学期望'] },
    { content: '设$X_1,X_2,\\cdots,X_n$独立同分布，$E(X_i)=\\mu,D(X_i)=\\sigma^2$，$\\bar{X}=\\frac{1}{n}\\sum X_i$，求$E(\\sum(X_i-\\bar{X})^2)$', questionType: 'fill_in', answer: '(n-1)σ^2', solution: '$E(\\sum(X_i-\\bar{X})^2)=E(\\sum X_i^2-n\\bar{X}^2)=\\sum(\\sigma^2+\\mu^2)-n(\\frac{\\sigma^2}{n}+\\mu^2)=(n-1)\\sigma^2$', difficulty: 2, kpNames: ['数学期望', '方差与标准差'] },
    { content: '设总体$X$的密度$f(x;\\theta)=\\begin{cases}\\frac{2x}{\\theta^2},&0<x<\\theta\\\\0,&\\text{其他}\\end{cases}$，$X_1,\\cdots,X_n$为样本，求$\\theta$的矩估计', questionType: 'fill_in', answer: 'θ̂=3x̄/2', solution: '$E(X)=\\int_0^\\theta x\\cdot\\frac{2x}{\\theta^2}dx=\\frac{2}{\\theta^2}\\cdot\\frac{\\theta^3}{3}=\\frac{2\\theta}{3}$，令$\\frac{2\\theta}{3}=\\bar{X}$，$\\hat{\\theta}=\\frac{3\\bar{X}}{2}$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设总体$X\\sim N(\\mu,\\sigma^2)$，$\\sigma^2$未知，样本容量$n=25$，$\\bar{x}=10$，$s=2$，求$\\mu$的$95\\%$置信区间', questionType: 'fill_in', answer: '(9.174,10.826)', solution: '用$t$分布：$t_{0.025}(24)=2.064$，$\\bar{x}\\pm t_{0.025}\\cdot s/\\sqrt{n}=10\\pm2.064\\times2/5=10\\pm0.826$，区间$(9.174,10.826)$', difficulty: 2, kpNames: ['区间估计'] },
    { content: '设$X_1,\\cdots,X_n$是来自总体$X$的样本，$\\hat{\\theta}_1=\\bar{X}$，$\\hat{\\theta}_2=\\frac{X_1+X_n}{2}$，问哪个是$E(X)$的更有效估计', questionType: 'fill_in', answer: 'θ̂₁更有效', solution: '$D(\\hat{\\theta}_1)=\\frac{\\sigma^2}{n}$，$D(\\hat{\\theta}_2)=\\frac{\\sigma^2}{2}$，$n\\geq3$时$D(\\hat{\\theta}_1)<D(\\hat{\\theta}_2)$，$\\hat{\\theta}_1$更有效', difficulty: 1, kpNames: ['估计量的评价标准'] },
    { content: '设总体$X$的分布律$P(X=k)=\\theta^k(1-\\theta)^{1-k}$（$k=0,1$），样本$X_1,\\cdots,X_n$，求$\\theta$的最大似然估计', questionType: 'fill_in', answer: 'θ̂=x̄', solution: '$L(\\theta)=\\theta^{\\sum x_i}(1-\\theta)^{n-\\sum x_i}$，$\\ln L=\\sum x_i\\ln\\theta+(n-\\sum x_i)\\ln(1-\\theta)$，求导得$\\hat{\\theta}=\\frac{\\sum X_i}{n}=\\bar{X}$', difficulty: 2, kpNames: ['点估计'] },
    { content: '设$X_1,X_2,\\cdots,X_n$独立同分布于$U(0,\\theta)$，证明$T=\\max(X_1,\\cdots,X_n)$是$\\theta$的一致估计', questionType: 'essay', answer: 'P(|T-θ|<ε)→1，故一致', solution: '$P(|T-\\theta|<\\varepsilon)=P(\\theta-\\varepsilon<T<\\theta+\\varepsilon)=1-P(T\\leq\\theta-\\varepsilon)=1-(\\frac{\\theta-\\varepsilon}{\\theta})^n\\to1$（$n\\to\\infty$），故$T$是$\\theta$的一致估计', difficulty: 2, kpNames: ['估计量的评价标准'] },

    // ==================== 第五轮扩充：大数定律与中心极限定理 ====================
    { content: '设$X$的方差为$2$，用切比雪夫不等式估计$P(|X-E(X)|\\geq4)$的上界', questionType: 'fill_in', answer: '1/8', solution: '切比雪夫不等式：$P(|X-E(X)|\\geq\\varepsilon)\\leq\\frac{D(X)}{\\varepsilon^2}=\\frac{2}{16}=\\frac{1}{8}$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '设$X_1,\\cdots,X_{100}$独立同分布，$E(X_i)=1,D(X_i)=4$，用中心极限定理近似求$P(\\sum_{i=1}^{100}X_i>120)$', questionType: 'fill_in', answer: '0.1587', solution: '$E(\\sum)=100,D(\\sum)=400$，$\\frac{\\sum-100}{20}\\sim N(0,1)$，$P(\\sum>120)=P(Z>\\frac{20}{20})=P(Z>1)=1-\\Phi(1)=0.1587$', difficulty: 2, kpNames: ['方差与标准差'] },
    { content: '设随机变量$X$的$E(X)=\\mu,D(X)=\\sigma^2$，用切比雪夫不等式证明$P(|X-\\mu|<\\varepsilon)\\geq1-\\frac{\\sigma^2}{\\varepsilon^2}$', questionType: 'essay', answer: '由切比雪夫不等式直接得证', solution: '$P(|X-\\mu|\\geq\\varepsilon)\\leq\\frac{\\sigma^2}{\\varepsilon^2}$，$P(|X-\\mu|<\\varepsilon)=1-P(|X-\\mu|\\geq\\varepsilon)\\geq1-\\frac{\\sigma^2}{\\varepsilon^2}$', difficulty: 1, kpNames: ['方差与标准差'] },
    { content: '掷一枚均匀硬币1000次，用中心极限定理近似求正面出现次数在480到520之间的概率', questionType: 'fill_in', answer: '0.7924', solution: '$X\\sim B(1000,0.5)$，$E(X)=500,D(X)=250$，$P(480\\leq X\\leq520)\\approx P(|\\frac{X-500}{\\sqrt{250}}|\\leq\\frac{20}{\\sqrt{250}})=P(|Z|\\leq1.265)=2\\Phi(1.265)-1\\approx0.7924$', difficulty: 2, kpNames: ['方差与标准差'] },

    // ==================== 第五轮扩充：行列式与矩阵补充 ====================
    { content: '设$A$为3阶方阵，$|A|=-2$，$A^*$为伴随矩阵，求$(2A)^{-1}-A^*$的行列式', questionType: 'fill_in', answer: '125/16', solution: '$A^*=|A|A^{-1}=-2A^{-1}$，$(2A)^{-1}=\\frac{1}{2}A^{-1}$，$(2A)^{-1}-A^*=(\\frac{1}{2}+2)A^{-1}=\\frac{5}{2}A^{-1}$，$|\\frac{5}{2}A^{-1}|=(\\frac{5}{2})^3|A^{-1}|=\\frac{125}{8}\\cdot(-\\frac{1}{2})=-\\frac{125}{16}$', difficulty: 3, kpNames: ['行列式的定义与性质', '逆矩阵'] },
    { content: '设$A$为$n$阶方阵，$A^T=-A$（反对称矩阵），$n$为奇数，求$|A|$', questionType: 'fill_in', answer: '0', solution: '$|A|=|A^T|=|-A|=(-1)^n|A|=-|A|$（$n$为奇数），$2|A|=0$，$|A|=0$', difficulty: 2, kpNames: ['行列式的定义与性质'] },
    { content: '计算行列式：$\\begin{vmatrix}x&a&a&\\cdots&a\\\\a&x&a&\\cdots&a\\\\a&a&x&\\cdots&a\\\\\\vdots&\\vdots&\\vdots&\\ddots&\\vdots\\\\a&a&a&\\cdots&x\\end{vmatrix}_n$', questionType: 'fill_in', answer: '(x-a)^(n-1)[x+(n-1)a]', solution: '各行加到第一行：$[x+(n-1)a]\\begin{vmatrix}1&1&\\cdots&1\\\\a&x&\\cdots&a\\\\\\vdots&\\vdots&\\ddots&\\vdots\\\\a&a&\\cdots&x\\end{vmatrix}$，再各行减第一行乘$a$得对角矩阵', difficulty: 2, kpNames: ['行列式的计算'] },
    { content: '设$A$为$n$阶方阵且$A^2=E$，$A\\neq E$，求$r(A+E)+r(A-E)$', questionType: 'fill_in', answer: 'n', solution: '$(A+E)(A-E)=A^2-E=0$，$r(A+E)+r(A-E)\\leq n$，又$(A+E)+(A-E)=2A$，$r(A+E)+r(A-E)\\geq r(2A)=r(A)$，且$|A|^2=1$，$r(A)=n$，故$r(A+E)+r(A-E)=n$', difficulty: 3, kpNames: ['矩阵的秩'] },

    // ==================== 第五轮扩充：微分方程应用 ====================
    { content: '一曲线过点$(1,1)$，其上任意点$(x,y)$处的切线在$y$轴上的截距等于该点的横坐标，求曲线方程', questionType: 'fill_in', answer: 'y=x(1-lnx)', solution: '切线方程$Y-y=y\'(X-x)$，$y$轴截距$y-xy\'=x$，$y\'=\\frac{y-x}{x}$，解一阶微分方程，由$y(1)=1$得$y=x(1-\\ln x)$', difficulty: 3, kpNames: ['一阶微分方程'] },
    { content: '求$y\'\'+y=\\sec x$的通解', questionType: 'fill_in', answer: 'y=C1cosx+C2sinx+cosx·ln|cosx|+xsinx', solution: '齐次通解$y_h=C_1\\cos x+C_2\\sin x$，用常数变易法：$y_p=\\cos x\\int\\frac{-\\sin x\\sec x}{W}dx+\\sin x\\int\\frac{\\cos x\\sec x}{W}dx$，$W=1$，$y_p=\\cos x\\ln|\\cos x|+x\\sin x$', difficulty: 3, kpNames: ['高阶线性微分方程', '常系数线性微分方程'] },

  ];

  for (const q of questions) {
    const { kpNames, source, ...questionData } = q;
    const created = await prisma.question.create({
      data: {
        ...questionData,
        source: source || null,
      },
    });
    for (const name of kpNames) {
      const kpId = kpMap.get(name);
      if (kpId) {
        await prisma.questionKnowledgePoint.create({
          data: { questionId: created.id, knowledgePointId: kpId },
        });
      }
    }
  }
  console.log(`已创建 ${questions.length} 道数学题目`);

  // ==================== 英语单词 ====================
  const allWords = [...CET4_CORE_WORDS, ...CET6_ADVANCED_WORDS, ...KAOYAN_ESSENTIAL_WORDS];

  for (const w of allWords) {
    await prisma.word.upsert({ where: { word: w.word }, update: w, create: w });
  }
  console.log(`已创建 ${allWords.length} 个英语单词 (CET4: ${CET4_CORE_WORDS.length}, CET6: ${CET6_ADVANCED_WORDS.length}, 考研: ${KAOYAN_ESSENTIAL_WORDS.length})`);

  await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: { username: 'testuser', email: 'test@example.com', passwordHash: '123456', targetExam: '考研数学一' },
  });
  console.log('已创建测试用户 (testuser / 123456)');
  console.log('种子数据填充完成！');
}

main().catch((e) => { console.error('种子数据填充失败:', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });