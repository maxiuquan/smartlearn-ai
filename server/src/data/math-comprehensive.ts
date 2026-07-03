export const MATH_COMPREHENSIVE_DATA = {
  categories: {
    math1: {
      name: '数学一',
      topics: ['高等数学', '线性代数', '概率论与数理统计'],
      examWeight: { advanced: '56%', linear: '22%', probability: '22%' },
    },
    math2: {
      name: '数学二',
      topics: ['高等数学', '线性代数'],
      examWeight: { advanced: '78%', linear: '22%' },
    },
    math3: {
      name: '数学三',
      topics: ['高等数学', '线性代数', '概率论与数理统计'],
      examWeight: { advanced: '56%', linear: '22%', probability: '22%' },
    },
  },

  mockExams: [
    {
      id: 'mock-2024-1',
      name: '2024年考研数学全真模拟卷（一）',
      categories: ['math1', 'math2', 'math3'],
      duration: 180,
      totalScore: 150,
      sections: [
        { type: '选择题', count: 10, scorePer: 5, total: 50 },
        { type: '填空题', count: 6, scorePer: 5, total: 30 },
        { type: '解答题', count: 6, scorePer: '不等', total: 70 },
      ],
    },
    {
      id: 'mock-2024-2',
      name: '2024年考研数学全真模拟卷（二）',
      categories: ['math1', 'math2', 'math3'],
      duration: 180,
      totalScore: 150,
    },
    {
      id: 'mock-2024-3',
      name: '2024年考研数学全真模拟卷（三）',
      categories: ['math1', 'math2', 'math3'],
      duration: 180,
      totalScore: 150,
    },
    {
      id: 'mock-2024-4',
      name: '2024年考研数学全真模拟卷（四）',
      categories: ['math1', 'math2', 'math3'],
      duration: 180,
      totalScore: 150,
    },
    {
      id: 'mock-2024-5',
      name: '2024年考研数学全真模拟卷（五）',
      categories: ['math1', 'math2', 'math3'],
      duration: 180,
      totalScore: 150,
    },
    {
      id: 'mock-2024-6',
      name: '2024年考研数学终极预测卷',
      categories: ['math1', 'math2', 'math3'],
      duration: 180,
      totalScore: 150,
    },
  ],

  realExams: [
    { year: 2024, name: '2024年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2023, name: '2023年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2022, name: '2022年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2021, name: '2021年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2020, name: '2020年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2019, name: '2019年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2018, name: '2018年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2017, name: '2017年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2016, name: '2016年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2015, name: '2015年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2014, name: '2014年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2013, name: '2013年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2012, name: '2012年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2011, name: '2011年考研数学真题', categories: ['math1', 'math2', 'math3'] },
    { year: 2010, name: '2010年考研数学真题', categories: ['math1', 'math2', 'math3'] },
  ],

  knowledgeTree: {
    advanced: {
      name: '高等数学',
      chapters: [
        { name: '函数、极限与连续', weight: '10%', keyPoints: ['极限的定义与性质', '极限运算法则', '两个重要极限', '无穷小比较', '函数的连续性', '间断点分类'] },
        { name: '一元函数微分学', weight: '20%', keyPoints: ['导数概念', '求导法则', '高阶导数', '微分', '中值定理', '洛必达法则', '泰勒公式', '极值与最值', '凹凸性'] },
        { name: '一元函数积分学', weight: '20%', keyPoints: ['不定积分', '定积分', '牛顿-莱布尼茨公式', '换元积分法', '分部积分法', '反常积分', '定积分应用'] },
        { name: '向量代数与空间解析几何', weight: '5%', keyPoints: ['向量运算', '平面与直线', '曲面与曲线'] },
        { name: '多元函数微分学', weight: '10%', keyPoints: ['偏导数', '全微分', '多元复合函数求导', '隐函数求导', '极值', '条件极值'] },
        { name: '多元函数积分学', weight: '10%', keyPoints: ['二重积分', '三重积分', '曲线积分', '曲面积分', '格林公式', '高斯公式'] },
        { name: '无穷级数', weight: '10%', keyPoints: ['常数项级数', '正项级数审敛法', '交错级数', '幂级数', '傅里叶级数'] },
        { name: '常微分方程', weight: '10%', keyPoints: ['一阶微分方程', '可降阶方程', '常系数线性方程', '欧拉方程'] },
      ],
    },
    linear: {
      name: '线性代数',
      chapters: [
        { name: '行列式', weight: '15%', keyPoints: ['行列式定义', '行列式性质', '克莱姆法则'] },
        { name: '矩阵', weight: '20%', keyPoints: ['矩阵运算', '逆矩阵', '矩阵的秩', '分块矩阵'] },
        { name: '向量', weight: '15%', keyPoints: ['线性表示', '线性相关性', '向量组的秩', '向量空间'] },
        { name: '线性方程组', weight: '20%', keyPoints: ['解的存在性', '解的结构', '基础解系'] },
        { name: '特征值与特征向量', weight: '15%', keyPoints: ['特征值与特征向量', '相似矩阵', '对角化', '实对称矩阵'] },
        { name: '二次型', weight: '15%', keyPoints: ['二次型及其矩阵', '标准形', '正定二次型'] },
      ],
    },
    probability: {
      name: '概率论与数理统计',
      chapters: [
        { name: '随机事件与概率', weight: '15%', keyPoints: ['样本空间', '概率定义', '条件概率', '全概率公式', '贝叶斯公式', '独立性'] },
        { name: '随机变量及其分布', weight: '20%', keyPoints: ['离散型随机变量', '连续型随机变量', '分布函数', '常见分布'] },
        { name: '多维随机变量', weight: '15%', keyPoints: ['联合分布', '边缘分布', '条件分布', '独立性', '协方差'] },
        { name: '数字特征', weight: '15%', keyPoints: ['数学期望', '方差', '协方差', '相关系数', '矩'] },
        { name: '大数定律与中心极限定理', weight: '10%', keyPoints: ['切比雪夫不等式', '大数定律', '中心极限定理'] },
        { name: '数理统计', weight: '15%', keyPoints: ['样本', '统计量', '抽样分布', '参数估计', '假设检验'] },
        { name: '参数估计', weight: '10%', keyPoints: ['点估计', '矩估计', '极大似然估计', '区间估计', '评价标准'] },
      ],
    },
  },
};