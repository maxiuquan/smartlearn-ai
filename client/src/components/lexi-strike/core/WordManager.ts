export interface WordEntry {
  en: string;
  zh: string;
  distractors: string[];
}

export interface ReviewWord extends WordEntry {
  srsLevel: number;
  nextReview: number;
  interval: number;
  easeFactor: number;
  correctCount: number;
  wrongCount: number;
  lastSeen: number;
}

const INTERVALS = [60, 180, 600, 1800, 3600, 7200, 14400, 28800, 86400];

const KAOYAN_WORDS: WordEntry[] = [
  { en: 'abandon', zh: '放弃；遗弃', distractors: ['遵守', '吸收'] },
  { en: 'address', zh: '演讲；处理', distractors: ['地址', '衣服'] },
  { en: 'benefit', zh: '利益；好处', distractors: ['损失', '风险'] },
  { en: 'capital', zh: '资本；首都', distractors: ['乡村', '劳动'] },
  { en: 'ephemeral', zh: '短暂的', distractors: ['永恒的', '坚固的'] },
  { en: 'ambiguous', zh: '模糊的；歧义的', distractors: ['清楚的', '直接的'] },
  { en: 'circumstance', zh: '环境；情况', distractors: ['原因', '结果'] },
  { en: 'contemporary', zh: '当代的；同时代的', distractors: ['古代的', '未来的'] },
  { en: 'demonstrate', zh: '证明；展示', distractors: ['隐藏', '否认'] },
  { en: 'sufficient', zh: '足够的；充分的', distractors: ['不足的', '多余的'] },
  { en: 'perspective', zh: '观点；视角', distractors: ['事实', '谎言'] },
  { en: 'inevitable', zh: '不可避免的', distractors: ['可避免的', '随机的'] },
  { en: 'substantial', zh: '大量的；实质的', distractors: ['微小的', '表面的'] },
  { en: 'consequence', zh: '结果；后果', distractors: ['原因', '过程'] },
  { en: 'phenomenon', zh: '现象', distractors: ['本质', '理论'] },
  { en: 'fundamental', zh: '基本的；根本的', distractors: ['次要的', '表面的'] },
  { en: 'controversial', zh: '有争议的', distractors: ['一致的', '公认的'] },
  { en: 'sophisticated', zh: '复杂的；精密的', distractors: ['简单的', '粗糙的'] },
  { en: 'comprehensive', zh: '全面的；综合的', distractors: ['片面的', '局部的'] },
  { en: 'extraordinary', zh: '非凡的；特别的', distractors: ['普通的', '平常的'] },
  { en: 'acknowledge', zh: '承认；确认', distractors: ['否认', '忽视'] },
  { en: 'accumulate', zh: '积累；积聚', distractors: ['减少', '分散'] },
  { en: 'alternative', zh: '替代的；替代方案', distractors: ['相同的', '唯一的'] },
  { en: 'anticipate', zh: '预期；期望', distractors: ['回忆', '忽视'] },
  { en: 'appropriate', zh: '适当的；合适的', distractors: ['不当的', '过度的'] },
  { en: 'approximate', zh: '大约的；近似的', distractors: ['精确的', '确定的'] },
  { en: 'artificial', zh: '人工的；人造的', distractors: ['自然的', '原始的'] },
  { en: 'associate', zh: '联系；关联', distractors: ['分离', '独立'] },
  { en: 'assumption', zh: '假设；假定', distractors: ['事实', '结论'] },
  { en: 'atmosphere', zh: '气氛；大气', distractors: ['真空', '地面'] },
  { en: 'available', zh: '可用的；有效的', distractors: ['不可用的', '过期的'] },
  { en: 'awareness', zh: '意识；认识', distractors: ['无知', '忽视'] },
  { en: 'bureaucracy', zh: '官僚机构', distractors: ['企业', '学校'] },
  { en: 'capability', zh: '能力；才能', distractors: ['无能', '缺陷'] },
  { en: 'characteristic', zh: '特征；特点', distractors: ['共性', '缺陷'] },
  { en: 'cognitive', zh: '认知的', distractors: ['情感的', '身体的'] },
  { en: 'compensate', zh: '补偿；赔偿', distractors: ['剥夺', '损害'] },
  { en: 'component', zh: '组成部分；成分', distractors: ['整体', '要素'] },
  { en: 'concentrate', zh: '集中；专注', distractors: ['分散', '忽视'] },
  { en: 'conception', zh: '概念；构想', distractors: ['事实', '误解'] },
  { en: 'conference', zh: '会议；讨论会', distractors: ['独处', '休息'] },
  { en: 'conservative', zh: '保守的；传统的', distractors: ['激进的', '创新的'] },
  { en: 'consistent', zh: '一致的；始终如一的', distractors: ['矛盾的', '多变的'] },
  { en: 'constitution', zh: '宪法；章程', distractors: ['法律', '合同'] },
  { en: 'construction', zh: '建设；建造', distractors: ['破坏', '拆除'] },
  { en: 'consumption', zh: '消费；消耗', distractors: ['生产', '储蓄'] },
  { en: 'contribution', zh: '贡献；捐赠', distractors: ['索取', '破坏'] },
  { en: 'conventional', zh: '传统的；常规的', distractors: ['创新的', '非常规的'] },
  { en: 'cooperation', zh: '合作；协作', distractors: ['竞争', '对抗'] },
  { en: 'corporation', zh: '公司；企业', distractors: ['个人', '政府'] },
  { en: 'correlation', zh: '关联；相互关系', distractors: ['独立', '无关'] },
  { en: 'correspond', zh: '对应；通信', distractors: ['背离', '中断'] },
  { en: 'criticism', zh: '批评；批判', distractors: ['赞扬', '支持'] },
  { en: 'cultivation', zh: '培养；耕作', distractors: ['破坏', '忽视'] },
  { en: 'curriculum', zh: '课程', distractors: ['课外', '娱乐'] },
  { en: 'declaration', zh: '宣言；声明', distractors: ['沉默', '否认'] },
  { en: 'democratic', zh: '民主的', distractors: ['专制的', '独裁的'] },
  { en: 'demonstrate', zh: '证明；展示', distractors: ['隐藏', '否认'] },
  { en: 'depression', zh: '抑郁；萧条', distractors: ['繁荣', '快乐'] },
  { en: 'determine', zh: '决定；确定', distractors: ['犹豫', '怀疑'] },
  { en: 'dimension', zh: '维度；尺寸', distractors: ['平面', '无限'] },
  { en: 'discipline', zh: '纪律；学科', distractors: ['混乱', '自由'] },
  { en: 'discrimination', zh: '歧视；辨别', distractors: ['平等', '包容'] },
  { en: 'distinction', zh: '区别；差别', distractors: ['相似', '相同'] },
  { en: 'distribution', zh: '分配；分布', distractors: ['集中', '聚集'] },
  { en: 'dominant', zh: '主导的；支配的', distractors: ['从属的', '次要的'] },
  { en: 'elaborate', zh: '精心制作的；详细说明', distractors: ['简略的', '粗糙的'] },
  { en: 'elementary', zh: '基本的；初级的', distractors: ['高级的', '复杂的'] },
  { en: 'eliminate', zh: '消除；淘汰', distractors: ['保留', '创造'] },
  { en: 'emergence', zh: '出现；浮现', distractors: ['消失', '隐藏'] },
  { en: 'emphasize', zh: '强调；着重', distractors: ['忽视', '淡化'] },
  { en: 'encounter', zh: '遭遇；遇到', distractors: ['避开', '忽视'] },
  { en: 'enormous', zh: '巨大的；庞大的', distractors: ['微小的', '渺小的'] },
  { en: 'enterprise', zh: '企业；事业', distractors: ['个人', '家庭'] },
  { en: 'enthusiasm', zh: '热情；热忱', distractors: ['冷漠', '厌倦'] },
  { en: 'equivalent', zh: '相等的；等价的', distractors: ['不同的', '不对等的'] },
  { en: 'essential', zh: '必要的；本质的', distractors: ['次要的', '多余的'] },
  { en: 'establish', zh: '建立；确立', distractors: ['破坏', '废除'] },
  { en: 'evaluate', zh: '评估；评价', distractors: ['忽视', '忽略'] },
  { en: 'evolution', zh: '进化；演变', distractors: ['退化', '停滞'] },
  { en: 'exaggerate', zh: '夸张；夸大', distractors: ['缩小', '如实'] },
  { en: 'exceed', zh: '超过；超越', distractors: ['落后', '不及'] },
  { en: 'exception', zh: '例外；除外', distractors: ['常规', '普遍'] },
  { en: 'exclusive', zh: '独家的；排他的', distractors: ['共享的', '包容的'] },
  { en: 'expansion', zh: '扩张；扩展', distractors: ['收缩', '缩小'] },
  { en: 'expenditure', zh: '支出；花费', distractors: ['收入', '储蓄'] },
  { en: 'exploitation', zh: '开发；剥削', distractors: ['保护', '维护'] },
  { en: 'extensive', zh: '广泛的；大量的', distractors: ['有限的', '狭小的'] },
  { en: 'facilitate', zh: '促进；便利', distractors: ['阻碍', '妨碍'] },
  { en: 'fluctuate', zh: '波动；起伏', distractors: ['稳定', '不变'] },
  { en: 'formulate', zh: '制定；规划', distractors: ['执行', '实施'] },
  { en: 'guarantee', zh: '保证；担保', distractors: ['否认', '拒绝'] },
  { en: 'hypothesis', zh: '假设；假说', distractors: ['事实', '理论'] },
  { en: 'identical', zh: '完全相同的', distractors: ['不同的', '相似的'] },
  { en: 'illustrate', zh: '说明；阐明', distractors: ['混淆', '隐藏'] },
  { en: 'implement', zh: '实施；执行', distractors: ['计划', '取消'] },
  { en: 'implication', zh: '含义；暗示', distractors: ['明示', '直言'] },
  { en: 'incentive', zh: '激励；动机', distractors: ['阻碍', '惩罚'] },
  { en: 'incorporate', zh: '包含；合并', distractors: ['排除', '分离'] },
  { en: 'indispensable', zh: '不可或缺的', distractors: ['可替代的', '多余的'] },
  { en: 'influence', zh: '影响；作用', distractors: ['无影响', '无关'] },
  { en: 'initiative', zh: '主动性；倡议', distractors: ['被动', '消极'] },
  { en: 'innovation', zh: '创新；革新', distractors: ['守旧', '传统'] },
  { en: 'institution', zh: '机构；制度', distractors: ['个人', '个体'] },
  { en: 'integrate', zh: '整合；融合', distractors: ['分离', '分割'] },
  { en: 'legislation', zh: '立法；法规', distractors: ['违法', '行政'] },
  { en: 'manipulate', zh: '操纵；控制', distractors: ['服从', '放任'] },
  { en: 'mechanism', zh: '机制；原理', distractors: ['结果', '现象'] },
  { en: 'negotiate', zh: '谈判；协商', distractors: ['对抗', '拒绝'] },
  { en: 'obligation', zh: '义务；责任', distractors: ['权利', '自由'] },
  { en: 'phenomenon', zh: '现象', distractors: ['本质', '规律'] },
  { en: 'predominant', zh: '主导的；主要的', distractors: ['次要的', '从属的'] },
  { en: 'prevail', zh: '盛行；占优势', distractors: ['衰退', '消失'] },
  { en: 'priority', zh: '优先；重点', distractors: ['次要', '忽略'] },
  { en: 'proportion', zh: '比例；部分', distractors: ['全部', '整体'] },
  { en: 'prosperity', zh: '繁荣；兴旺', distractors: ['衰退', '萧条'] },
  { en: 'psychology', zh: '心理学', distractors: ['物理学', '生物学'] },
  { en: 'publication', zh: '出版；发行', distractors: ['禁书', '销毁'] },
  { en: 'qualitative', zh: '定性的；质量的', distractors: ['定量的', '数量的'] },
  { en: 'recognition', zh: '识别；认可', distractors: ['否认', '忽视'] },
  { en: 'regulation', zh: '规则；管理', distractors: ['混乱', '无序'] },
  { en: 'reinforce', zh: '加强；强化', distractors: ['削弱', '减弱'] },
  { en: 'reluctant', zh: '不情愿的；勉强的', distractors: ['乐意的', '积极的'] },
  { en: 'resolution', zh: '决心；决议', distractors: ['犹豫', '放弃'] },
  { en: 'revolution', zh: '革命；变革', distractors: ['保守', '稳定'] },
  { en: 'significant', zh: '重要的；显著的', distractors: ['无关的', '微小的'] },
  { en: 'sophisticated', zh: '复杂的；精密的', distractors: ['简单的', '粗糙的'] },
  { en: 'speculation', zh: '推测；投机', distractors: ['事实', '确定'] },
  { en: 'subordinate', zh: '下属；从属的', distractors: ['上级', '主导的'] },
  { en: 'substitute', zh: '替代品；替代', distractors: ['原件', '保留'] },
  { en: 'superficial', zh: '表面的；肤浅的', distractors: ['深刻的', '本质的'] },
  { en: 'sustainable', zh: '可持续的', distractors: ['短暂的', '不可持续的'] },
  { en: 'symptom', zh: '症状；征兆', distractors: ['原因', '结果'] },
  { en: 'tendency', zh: '趋势；倾向', distractors: ['逆向', '反向'] },
  { en: 'transparent', zh: '透明的；明显的', distractors: ['模糊的', '不透明的'] },
  { en: 'ultimate', zh: '最终的；根本的', distractors: ['初步的', '次要的'] },
  { en: 'undergo', zh: '经历；遭受', distractors: ['避免', '逃避'] },
  { en: 'underlying', zh: '潜在的；根本的', distractors: ['表面的', '明显的'] },
  { en: 'universal', zh: '普遍的；全体的', distractors: ['局部的', '个别的'] },
  { en: 'variation', zh: '变化；差异', distractors: ['不变', '一致'] },
  { en: 'vulnerable', zh: '脆弱的；易受伤的', distractors: ['坚强的', '强势的'] },
  { en: 'widespread', zh: '广泛的；普遍的', distractors: ['局部的', '有限的'] },
  { en: 'worthwhile', zh: '值得的', distractors: ['无用的', '浪费的'] },
  { en: 'accelerate', zh: '加速；促进', distractors: ['减速', '停止'] },
  { en: 'accommodate', zh: '容纳；适应', distractors: ['排斥', '拒绝'] },
  { en: 'accompany', zh: '陪伴；伴随', distractors: ['离开', '忽视'] },
  { en: 'accomplish', zh: '完成；实现', distractors: ['失败', '放弃'] },
  { en: 'accumulate', zh: '积累；积聚', distractors: ['减少', '分散'] },
  { en: 'acquaintance', zh: '熟人；相识', distractors: ['陌生人', '敌人'] },
  { en: 'activation', zh: '激活；启动', distractors: ['关闭', '停止'] },
  { en: 'adaptation', zh: '适应；改编', distractors: ['不适', '停止'] },
  { en: 'administration', zh: '管理；行政', distractors: ['混乱', '无序'] },
  { en: 'adolescent', zh: '青少年', distractors: ['成人', '老人'] },
  { en: 'aggravate', zh: '加重；恶化', distractors: ['减轻', '改善'] },
  { en: 'alienation', zh: '疏远；异化', distractors: ['亲近', '融合'] },
  { en: 'allocation', zh: '分配；配置', distractors: ['收回', '集中'] },
  { en: 'alternation', zh: '交替；轮流', distractors: ['固定', '不变'] },
  { en: 'ambassador', zh: '大使；代表', distractors: ['平民', '敌人'] },
  { en: 'anniversary', zh: '周年纪念日', distractors: ['日常', '普通日'] },
  { en: 'apparatus', zh: '设备；仪器', distractors: ['人力', '软件'] },
  { en: 'appreciation', zh: '欣赏；感激', distractors: ['蔑视', '厌恶'] },
  { en: 'arbitrary', zh: '任意的；专断的', distractors: ['合理的', '有序的'] },
  { en: 'architecture', zh: '建筑；架构', distractors: ['破坏', '废墟'] },
  { en: 'articulate', zh: '清楚表达的', distractors: ['含糊的', '混乱的'] },
  { en: 'assertion', zh: '断言；主张', distractors: ['否认', '怀疑'] },
  { en: 'assessment', zh: '评估；评定', distractors: ['忽视', '忽略'] },
  { en: 'assignment', zh: '任务；分配', distractors: ['自由', '空闲'] },
  { en: 'assimilation', zh: '吸收；同化', distractors: ['排斥', '排斥'] },
  { en: 'assumption', zh: '假设；假定', distractors: ['事实', '结论'] },
  { en: 'attainment', zh: '达到；获得', distractors: ['失去', '失败'] },
  { en: 'authenticity', zh: '真实性；可靠性', distractors: ['虚假', '伪造'] },
  { en: 'authoritative', zh: '权威的；官方的', distractors: ['非官方的', '不可靠的'] },
  { en: 'availability', zh: '可用性；有效性', distractors: ['不可用', '无效'] },
  { en: 'bankruptcy', zh: '破产', distractors: ['繁荣', '盈利'] },
  { en: 'beneficiary', zh: '受益人；受惠者', distractors: ['受害者', '施害者'] },
  { en: 'bibliography', zh: '参考书目', distractors: ['正文', '前言'] },
  { en: 'bilingual', zh: '双语的', distractors: ['单语的', '多语的'] },
  { en: 'biography', zh: '传记', distractors: ['小说', '诗歌'] },
  { en: 'breakthrough', zh: '突破；重大进展', distractors: ['倒退', '停滞'] },
  { en: 'broadcasting', zh: '广播；播放', distractors: ['接收', '收听'] },
  { en: 'calculation', zh: '计算；估计', distractors: ['猜测', '忽略'] },
  { en: 'catastrophe', zh: '灾难；大祸', distractors: ['幸运', '好事'] },
  { en: 'certificate', zh: '证书；证明', distractors: ['否认', '拒绝'] },
  { en: 'circulation', zh: '流通；循环', distractors: ['停滞', '停止'] },
  { en: 'classification', zh: '分类；分级', distractors: ['混合', '混乱'] },
  { en: 'coincidence', zh: '巧合；同时发生', distractors: ['必然', '计划'] },
  { en: 'collaboration', zh: '合作；协作', distractors: ['竞争', '对抗'] },
  { en: 'commemorate', zh: '纪念；庆祝', distractors: ['遗忘', '忽视'] },
  { en: 'commission', zh: '委员会；佣金', distractors: ['个人', '解散'] },
  { en: 'commitment', zh: '承诺；投入', distractors: ['放弃', '背叛'] },
  { en: 'commodity', zh: '商品；货物', distractors: ['服务', '免费'] },
  { en: 'commonwealth', zh: '联邦；共同体', distractors: ['个体', '分裂'] },
  { en: 'comparative', zh: '比较的；相对的', distractors: ['绝对的', '独立的'] },
  { en: 'compensation', zh: '补偿；赔偿', distractors: ['损失', '剥夺'] },
  { en: 'competence', zh: '能力；胜任', distractors: ['无能', '缺陷'] },
  { en: 'competition', zh: '竞争；比赛', distractors: ['合作', '协作'] },
  { en: 'complaint', zh: '投诉；抱怨', distractors: ['赞扬', '满意'] },
  { en: 'complement', zh: '补充；补足', distractors: ['减少', '删除'] },
  { en: 'complexity', zh: '复杂性；复杂度', distractors: ['简单', '明了'] },
  { en: 'complication', zh: '复杂化；并发症', distractors: ['简化', '解决'] },
  { en: 'compromise', zh: '妥协；折中', distractors: ['坚持', '对抗'] },
  { en: 'concentration', zh: '集中；专注', distractors: ['分散', '忽视'] },
  { en: 'conception', zh: '概念；构想', distractors: ['事实', '误解'] },
  { en: 'confirmation', zh: '确认；证实', distractors: ['否认', '拒绝'] },
  { en: 'confrontation', zh: '对抗；面对', distractors: ['回避', '逃避'] },
  { en: 'congregation', zh: '集合；人群', distractors: ['分散', '分离'] },
  { en: 'consciousness', zh: '意识；知觉', distractors: ['无知', '昏迷'] },
  { en: 'consequence', zh: '结果；后果', distractors: ['原因', '起因'] },
  { en: 'conservation', zh: '保护；保存', distractors: ['破坏', '浪费'] },
  { en: 'considerable', zh: '相当大的', distractors: ['微小的', '可忽略的'] },
  { en: 'consistency', zh: '一致性；连贯性', distractors: ['矛盾', '不一致'] },
  { en: 'consolidation', zh: '巩固；合并', distractors: ['分裂', '削弱'] },
  { en: 'conspicuous', zh: '显眼的；明显的', distractors: ['隐蔽的', '不显眼的'] },
  { en: 'constitution', zh: '宪法；体质', distractors: ['违法', '病态'] },
  { en: 'construction', zh: '建设；建造', distractors: ['破坏', '拆除'] },
  { en: 'consultation', zh: '咨询；商议', distractors: ['独断', '决定'] },
  { en: 'consumption', zh: '消费；消耗', distractors: ['生产', '储蓄'] },
  { en: 'contamination', zh: '污染；玷污', distractors: ['净化', '清洁'] },
  { en: 'contemplation', zh: '沉思；凝视', distractors: ['行动', '忽视'] },
  { en: 'contemporary', zh: '当代的', distractors: ['古代的', '未来的'] },
  { en: 'contradiction', zh: '矛盾；反驳', distractors: ['一致', '同意'] },
  { en: 'contribution', zh: '贡献；捐赠', distractors: ['索取', '破坏'] },
  { en: 'controversial', zh: '有争议的', distractors: ['一致的', '公认的'] },
  { en: 'convenience', zh: '便利；方便', distractors: ['不便', '麻烦'] },
  { en: 'conventional', zh: '传统的；常规的', distractors: ['创新的', '非常规的'] },
  { en: 'cooperation', zh: '合作；协作', distractors: ['竞争', '对抗'] },
  { en: 'coordination', zh: '协调；配合', distractors: ['混乱', '冲突'] },
  { en: 'corporation', zh: '公司；企业', distractors: ['个人', '政府'] },
  { en: 'correlation', zh: '关联；相互关系', distractors: ['独立', '无关'] },
  { en: 'correspondence', zh: '对应；通信', distractors: ['中断', '背离'] },
  { en: 'counterpart', zh: '对应的人或物', distractors: ['无关', '对立'] },
  { en: 'credibility', zh: '可信度；可靠性', distractors: ['不可信', '怀疑'] },
  { en: 'cultivation', zh: '培养；耕作', distractors: ['破坏', '忽视'] },
  { en: 'curriculum', zh: '课程', distractors: ['课外', '娱乐'] },
  { en: 'declaration', zh: '宣言；声明', distractors: ['沉默', '否认'] },
  { en: 'deficiency', zh: '缺乏；不足', distractors: ['充足', '过剩'] },
  { en: 'definition', zh: '定义；释义', distractors: ['模糊', '歧义'] },
  { en: 'delegation', zh: '代表团；委托', distractors: ['个人', '撤回'] },
  { en: 'deliberate', zh: '故意的；深思熟虑的', distractors: ['无意的', '随意的'] },
  { en: 'democratic', zh: '民主的', distractors: ['专制的', '独裁的'] },
  { en: 'demonstration', zh: '证明；示威', distractors: ['隐藏', '否认'] },
  { en: 'dependence', zh: '依赖；依靠', distractors: ['独立', '自主'] },
  { en: 'depreciation', zh: '贬值；折旧', distractors: ['升值', '增值'] },
  { en: 'depression', zh: '抑郁；萧条', distractors: ['繁荣', '快乐'] },
  { en: 'destruction', zh: '破坏；毁灭', distractors: ['建设', '创造'] },
  { en: 'determination', zh: '决心；决定', distractors: ['犹豫', '怀疑'] },
  { en: 'deterioration', zh: '恶化；变坏', distractors: ['改善', '好转'] },
  { en: 'development', zh: '发展；开发', distractors: ['衰退', '停滞'] },
  { en: 'differential', zh: '差别的；微分的', distractors: ['相同的', '相等的'] },
  { en: 'dilemma', zh: '困境；进退两难', distractors: ['优势', '顺利'] },
  { en: 'dimension', zh: '维度；尺寸', distractors: ['平面', '无限'] },
  { en: 'disability', zh: '残疾；无能', distractors: ['能力', '健康'] },
  { en: 'disadvantage', zh: '劣势；不利', distractors: ['优势', '有利'] },
  { en: 'disappointment', zh: '失望；沮丧', distractors: ['满意', '高兴'] },
  { en: 'disciplinary', zh: '纪律的；学科的', distractors: ['混乱的', '自由的'] },
  { en: 'discrimination', zh: '歧视；辨别', distractors: ['平等', '包容'] },
  { en: 'distinction', zh: '区别；差别', distractors: ['相似', '相同'] },
  { en: 'distribution', zh: '分配；分布', distractors: ['集中', '聚集'] },
  { en: 'diversification', zh: '多样化', distractors: ['单一', '统一'] },
  { en: 'documentation', zh: '文件；文档', distractors: ['口头', '记忆'] },
  { en: 'domination', zh: '支配；统治', distractors: ['服从', '从属'] },
  { en: 'durability', zh: '耐久性；持久', distractors: ['脆弱', '短暂'] },
  { en: 'eccentric', zh: '古怪的；反常的', distractors: ['正常的', '普通的'] },
  { en: 'effectiveness', zh: '有效性；效果', distractors: ['无效', '无用'] },
  { en: 'elaboration', zh: '详细说明；精心制作', distractors: ['简化', '省略'] },
  { en: 'elimination', zh: '消除；淘汰', distractors: ['保留', '创造'] },
  { en: 'embarrassment', zh: '尴尬；窘迫', distractors: ['自在', '舒适'] },
  { en: 'entrepreneur', zh: '企业家', distractors: ['员工', '工人'] },
  { en: 'environment', zh: '环境', distractors: ['内部', '个人'] },
  { en: 'establishment', zh: '建立；机构', distractors: ['废除', '解散'] },
  { en: 'evaluation', zh: '评估；评价', distractors: ['忽视', '忽略'] },
  { en: 'exaggeration', zh: '夸张；夸大', distractors: ['如实', '缩小'] },
  { en: 'examination', zh: '考试；检查', distractors: ['忽略', '跳过'] },
  { en: 'expenditure', zh: '支出；花费', distractors: ['收入', '储蓄'] },
  { en: 'exploitation', zh: '开发；剥削', distractors: ['保护', '维护'] },
  { en: 'extraordinary', zh: '非凡的；特别的', distractors: ['普通的', '平常的'] },
  { en: 'extravagant', zh: '奢侈的；过度的', distractors: ['节俭的', '朴素的'] },
  { en: 'facilitation', zh: '促进；便利', distractors: ['阻碍', '妨碍'] },
  { en: 'fascination', zh: '着迷；魅力', distractors: ['厌倦', '无聊'] },
  { en: 'flexibility', zh: '灵活性；弹性', distractors: ['僵硬', '死板'] },
  { en: 'fluctuation', zh: '波动；起伏', distractors: ['稳定', '不变'] },
  { en: 'formulation', zh: '制定；规划', distractors: ['执行', '实施'] },
  { en: 'frustration', zh: '挫折；沮丧', distractors: ['满足', '成功'] },
  { en: 'fundamental', zh: '基本的；根本的', distractors: ['次要的', '表面的'] },
  { en: 'generalization', zh: '概括；归纳', distractors: ['具体', '细节'] },
  { en: 'globalization', zh: '全球化', distractors: ['本地化', '区域化'] },
  { en: 'harassment', zh: '骚扰；困扰', distractors: ['帮助', '支持'] },
  { en: 'hospitality', zh: '好客；款待', distractors: ['冷漠', '拒绝'] },
  { en: 'hypothesis', zh: '假设；假说', distractors: ['事实', '理论'] },
  { en: 'identification', zh: '识别；鉴定', distractors: ['混淆', '误解'] },
  { en: 'illustration', zh: '说明；插图', distractors: ['文字', '描述'] },
  { en: 'imagination', zh: '想象力；创造力', distractors: ['现实', '实际'] },
  { en: 'immigration', zh: '移民；移居', distractors: ['移民出去', '定居'] },
  { en: 'implementation', zh: '实施；执行', distractors: ['计划', '取消'] },
  { en: 'implication', zh: '含义；暗示', distractors: ['明示', '直言'] },
  { en: 'importation', zh: '进口；输入', distractors: ['出口', '输出'] },
  { en: 'impression', zh: '印象；印记', distractors: ['忘记', '忽视'] },
  { en: 'improvement', zh: '改进；改善', distractors: ['恶化', '退步'] },
  { en: 'inadequacy', zh: '不足；不充分', distractors: ['充足', '充裕'] },
  { en: 'incapability', zh: '无能；无力', distractors: ['能力', '才能'] },
  { en: 'incorporation', zh: '包含；合并', distractors: ['排除', '分离'] },
  { en: 'independence', zh: '独立；自主', distractors: ['依赖', '依靠'] },
  { en: 'indication', zh: '指示；迹象', distractors: ['隐藏', '掩盖'] },
  { en: 'ineffectiveness', zh: '无效；无用', distractors: ['有效', '有用'] },
  { en: 'inequality', zh: '不平等；不均衡', distractors: ['平等', '均衡'] },
  { en: 'inevitability', zh: '不可避免', distractors: ['可避免', '偶然'] },
  { en: 'infrastructure', zh: '基础设施', distractors: ['上层建筑', '软件'] },
  { en: 'ingenuity', zh: '独创性；巧妙', distractors: ['平庸', '普通'] },
  { en: 'inhabitant', zh: '居民；居住者', distractors: ['游客', '访客'] },
  { en: 'initiative', zh: '主动性；倡议', distractors: ['被动', '消极'] },
  { en: 'innovation', zh: '创新；革新', distractors: ['守旧', '传统'] },
  { en: 'inscription', zh: '铭文；题词', distractors: ['空白', '擦除'] },
  { en: 'inspection', zh: '检查；视察', distractors: ['忽视', '忽略'] },
  { en: 'inspiration', zh: '灵感；启发', distractors: ['平淡', '无聊'] },
  { en: 'installation', zh: '安装；装置', distractors: ['拆卸', '拆除'] },
  { en: 'institution', zh: '机构；制度', distractors: ['个人', '个体'] },
  { en: 'instrument', zh: '工具；仪器', distractors: ['徒手', '人力'] },
  { en: 'integration', zh: '整合；融合', distractors: ['分离', '分割'] },
  { en: 'intellectual', zh: '智力的；知识分子', distractors: ['体力的', '工人'] },
  { en: 'intelligence', zh: '智力；情报', distractors: ['愚蠢', '无知'] },
  { en: 'interaction', zh: '互动；相互作用', distractors: ['孤立', '独立'] },
  { en: 'interference', zh: '干涉；干扰', distractors: ['帮助', '支持'] },
  { en: 'interpretation', zh: '解释；口译', distractors: ['误解', '曲解'] },
  { en: 'intervention', zh: '干预；介入', distractors: ['旁观', '放任'] },
  { en: 'introduction', zh: '介绍；引入', distractors: ['结束', '删除'] },
  { en: 'investigation', zh: '调查；研究', distractors: ['忽视', '忽略'] },
  { en: 'involvement', zh: '参与；卷入', distractors: ['退出', '脱离'] },
  { en: 'irregularity', zh: '不规则；异常', distractors: ['规则', '正常'] },
  { en: 'irrigation', zh: '灌溉', distractors: ['干旱', '排水'] },
  { en: 'justification', zh: '正当理由；辩护', distractors: ['无理', '错误'] },
  { en: 'legislation', zh: '立法；法规', distractors: ['违法', '行政'] },
  { en: 'limitation', zh: '限制；局限', distractors: ['自由', '无限'] },
  { en: 'manipulation', zh: '操纵；控制', distractors: ['服从', '放任'] },
  { en: 'manufacture', zh: '制造；生产', distractors: ['消费', '销毁'] },
  { en: 'measurement', zh: '测量；衡量', distractors: ['估计', '猜测'] },
  { en: 'mechanism', zh: '机制；原理', distractors: ['结果', '现象'] },
  { en: 'meditation', zh: '冥想；沉思', distractors: ['行动', '分心'] },
  { en: 'methodology', zh: '方法论', distractors: ['实践', '结果'] },
  { en: 'migration', zh: '迁移；迁徙', distractors: ['定居', '停留'] },
  { en: 'mobilization', zh: '动员；调动', distractors: ['解散', '静止'] },
  { en: 'modification', zh: '修改；调整', distractors: ['保持', '不变'] },
  { en: 'monopolization', zh: '垄断', distractors: ['竞争', '开放'] },
  { en: 'motivation', zh: '动机；动力', distractors: ['懒惰', '消极'] },
  { en: 'negotiation', zh: '谈判；协商', distractors: ['对抗', '拒绝'] },
  { en: 'normalization', zh: '正常化；标准化', distractors: ['异常', '混乱'] },
  { en: 'notification', zh: '通知；通告', distractors: ['沉默', '保密'] },
  { en: 'obligation', zh: '义务；责任', distractors: ['权利', '自由'] },
  { en: 'observation', zh: '观察；观测', distractors: ['忽视', '忽略'] },
  { en: 'occupation', zh: '职业；占领', distractors: ['休闲', '空闲'] },
  { en: 'optimization', zh: '优化；最佳化', distractors: ['恶化', '退化'] },
  { en: 'organization', zh: '组织；机构', distractors: ['混乱', '无序'] },
  { en: 'orientation', zh: '方向；定位', distractors: ['迷失', '混乱'] },
  { en: 'participation', zh: '参与；参加', distractors: ['退出', '旁观'] },
  { en: 'penetration', zh: '渗透；穿透', distractors: ['反弹', '阻挡'] },
  { en: 'perception', zh: '感知；看法', distractors: ['无知', '忽视'] },
  { en: 'performance', zh: '表现；性能', distractors: ['失败', '无能'] },
  { en: 'phenomenon', zh: '现象', distractors: ['本质', '规律'] },
  { en: 'popularity', zh: '流行；普及', distractors: ['冷门', '小众'] },
  { en: 'possession', zh: '拥有；财产', distractors: ['缺乏', '失去'] },
  { en: 'precaution', zh: '预防；警惕', distractors: ['冒险', '忽视'] },
  { en: 'precipitation', zh: '降水；沉淀', distractors: ['蒸发', '干旱'] },
  { en: 'preference', zh: '偏好；偏爱', distractors: ['厌恶', '讨厌'] },
  { en: 'preparation', zh: '准备；预备', distractors: ['忽视', '忽略'] },
  { en: 'prescription', zh: '处方；规定', distractors: ['自由', '随意'] },
  { en: 'presentation', zh: '演示；呈现', distractors: ['隐藏', '掩盖'] },
  { en: 'preservation', zh: '保存；保护', distractors: ['破坏', '毁灭'] },
  { en: 'presumption', zh: '假定；推测', distractors: ['事实', '确定'] },
  { en: 'prevention', zh: '预防；阻止', distractors: ['促进', '鼓励'] },
  { en: 'prioritization', zh: '优先排序', distractors: ['随机', '无序'] },
  { en: 'probability', zh: '可能性；概率', distractors: ['确定性', '必然'] },
  { en: 'proclamation', zh: '宣告；公告', distractors: ['沉默', '保密'] },
  { en: 'productivity', zh: '生产力；效率', distractors: ['低效', '懒惰'] },
  { en: 'prohibition', zh: '禁止；禁令', distractors: ['允许', '鼓励'] },
  { en: 'proliferation', zh: '扩散；激增', distractors: ['减少', '收缩'] },
  { en: 'proportion', zh: '比例；部分', distractors: ['全部', '整体'] },
  { en: 'prosecution', zh: '起诉；检举', distractors: ['辩护', '保护'] },
  { en: 'prosperity', zh: '繁荣；兴旺', distractors: ['衰退', '萧条'] },
  { en: 'protection', zh: '保护；防护', distractors: ['伤害', '破坏'] },
  { en: 'psychology', zh: '心理学', distractors: ['物理学', '生物学'] },
  { en: 'publication', zh: '出版；发行', distractors: ['禁书', '销毁'] },
  { en: 'qualification', zh: '资格；条件', distractors: ['不合格', '无资格'] },
  { en: 'rationality', zh: '合理性；理性', distractors: ['非理性', '感性'] },
  { en: 'realization', zh: '实现；认识', distractors: ['忽视', '失败'] },
  { en: 'reception', zh: '接待；接收', distractors: ['拒绝', '发送'] },
  { en: 'recognition', zh: '识别；认可', distractors: ['否认', '忽视'] },
  { en: 'recommendation', zh: '推荐；建议', distractors: ['反对', '拒绝'] },
  { en: 'recruitment', zh: '招聘；招募', distractors: ['解雇', '裁员'] },
  { en: 'refinement', zh: '精炼；改进', distractors: ['粗糙', '退化'] },
  { en: 'reflection', zh: '反思；反映', distractors: ['忽视', '忽略'] },
  { en: 'registration', zh: '注册；登记', distractors: ['注销', '删除'] },
  { en: 'regulation', zh: '规则；管理', distractors: ['混乱', '无序'] },
  { en: 'reinforcement', zh: '加强；强化', distractors: ['削弱', '减弱'] },
  { en: 'relationship', zh: '关系；关联', distractors: ['无关', '独立'] },
  { en: 'relaxation', zh: '放松；松弛', distractors: ['紧张', '压力'] },
  { en: 'reliability', zh: '可靠性', distractors: ['不可靠', '不稳定'] },
  { en: 'reluctance', zh: '不情愿；勉强', distractors: ['乐意', '积极'] },
  { en: 'renewal', zh: '更新；续期', distractors: ['过期', '作废'] },
  { en: 'replacement', zh: '替换；替代', distractors: ['保留', '维持'] },
  { en: 'representation', zh: '代表；表示', distractors: ['缺席', '真实'] },
  { en: 'reproduction', zh: '繁殖；复制', distractors: ['灭绝', '毁灭'] },
  { en: 'reputation', zh: '名声；声誉', distractors: ['无名', '默默无闻'] },
  { en: 'requirement', zh: '要求；需求', distractors: ['可选', '自由'] },
  { en: 'reservation', zh: '预订；保留', distractors: ['取消', '释放'] },
  { en: 'resignation', zh: '辞职；放弃', distractors: ['就职', '坚持'] },
  { en: 'resolution', zh: '决心；决议', distractors: ['犹豫', '放弃'] },
  { en: 'restoration', zh: '恢复；修复', distractors: ['破坏', '毁灭'] },
  { en: 'restriction', zh: '限制；约束', distractors: ['自由', '开放'] },
  { en: 'revelation', zh: '揭示；启示', distractors: ['隐藏', '掩盖'] },
  { en: 'revolution', zh: '革命；变革', distractors: ['保守', '稳定'] },
  { en: 'satisfaction', zh: '满意；满足', distractors: ['不满', '失望'] },
  { en: 'sensitivity', zh: '敏感；灵敏度', distractors: ['迟钝', '麻木'] },
  { en: 'separation', zh: '分离；分开', distractors: ['合并', '结合'] },
  { en: 'significance', zh: '重要性；意义', distractors: ['无关', '微小'] },
  { en: 'simplification', zh: '简化', distractors: ['复杂化', '繁琐'] },
  { en: 'solidarity', zh: '团结；一致', distractors: ['分裂', '对立'] },
  { en: 'specialization', zh: '专业化；专门化', distractors: ['通用', '广泛'] },
  { en: 'specification', zh: '规格；说明', distractors: ['模糊', '概括'] },
  { en: 'spectacular', zh: '壮观的；惊人的', distractors: ['平淡的', '普通的'] },
  { en: 'stabilization', zh: '稳定；安定', distractors: ['动荡', '混乱'] },
  { en: 'standardization', zh: '标准化', distractors: ['多样化', '个性化'] },
  { en: 'stimulation', zh: '刺激；激励', distractors: ['抑制', '镇压'] },
  { en: 'subordination', zh: '从属；下级', distractors: ['主导', '上级'] },
  { en: 'subscription', zh: '订阅；订购', distractors: ['取消', '退订'] },
  { en: 'substitution', zh: '替代；替换', distractors: ['保留', '维持'] },
  { en: 'supervision', zh: '监督；管理', distractors: ['放任', '忽视'] },
  { en: 'supplement', zh: '补充；增补', distractors: ['减少', '删减'] },
  { en: 'sustainability', zh: '可持续性', distractors: ['短暂', '不可持续'] },
  { en: 'termination', zh: '终止；结束', distractors: ['开始', '启动'] },
  { en: 'transformation', zh: '转变；改造', distractors: ['不变', '维持'] },
  { en: 'transparency', zh: '透明；清晰', distractors: ['模糊', '不透明'] },
  { en: 'uncertainty', zh: '不确定性', distractors: ['确定', '必然'] },
  { en: 'unemployment', zh: '失业', distractors: ['就业', '工作'] },
  { en: 'unification', zh: '统一；联合', distractors: ['分裂', '分离'] },
  { en: 'utilization', zh: '利用；使用', distractors: ['浪费', '闲置'] },
  { en: 'validation', zh: '验证；确认', distractors: ['否认', '拒绝'] },
  { en: 'variability', zh: '可变性；变化', distractors: ['不变', '稳定'] },
  { en: 'ventilation', zh: '通风；换气', distractors: ['封闭', '密封'] },
  { en: 'verification', zh: '验证；核实', distractors: ['否认', '伪造'] },
  { en: 'versatility', zh: '多才多艺；多功能', distractors: ['单一', '局限'] },
  { en: 'visibility', zh: '可见度；能见度', distractors: ['不可见', '隐藏'] },
  { en: 'visualization', zh: '可视化；想象', distractors: ['隐藏', '模糊'] },
  { en: 'vulnerability', zh: '脆弱性；弱点', distractors: ['坚强', '优势'] },
  { en: 'withdrawal', zh: '撤回；退出', distractors: ['进入', '参与'] },
];

export class WordManager {
  private words: WordEntry[] = [...KAOYAN_WORDS];
  private reviewMap: Map<string, ReviewWord> = new Map();
  private reviewQueue: string[] = [];
  private currentIndex = 0;

  constructor() {
    this.loadFromStorage();
  }

  getAllWords(): WordEntry[] {
    return this.words;
  }

  getNextWord(): WordEntry | null {
    if (this.reviewQueue.length > 0) {
      const en = this.reviewQueue.shift()!;
      const word = this.reviewMap.get(en);
      if (word && word.nextReview <= Date.now() / 1000) {
        return { en: word.en, zh: word.zh, distractors: word.distractors };
      }
    }

    if (this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
      this.shuffle();
    }

    return this.words[this.currentIndex++];
  }

  recordAnswer(en: string, correct: boolean): void {
    const word = this.words.find(w => w.en === en);
    if (!word) return;

    let review = this.reviewMap.get(en);
    if (!review) {
      review = {
        ...word,
        srsLevel: 0,
        nextReview: 0,
        interval: 60,
        easeFactor: 2.5,
        correctCount: 0,
        wrongCount: 0,
        lastSeen: Date.now() / 1000,
      };
      this.reviewMap.set(en, review);
    }

    review.lastSeen = Date.now() / 1000;

    if (correct) {
      review.correctCount++;
      review.srsLevel = Math.min(review.srsLevel + 1, 8);
      review.interval = this.getSRSInterval(review.srsLevel);
      review.easeFactor = Math.max(1.3, review.easeFactor + 0.1);
    } else {
      review.wrongCount++;
      review.srsLevel = Math.max(0, review.srsLevel - 1);
      review.interval = this.getSRSInterval(review.srsLevel);
      review.easeFactor = Math.max(1.3, review.easeFactor - 0.2);
      this.reviewQueue.push(en);
    }

    review.nextReview = Date.now() / 1000 + review.interval * review.easeFactor;
    this.saveToStorage();
  }

  private getSRSInterval(level: number): number {
    const intervals = [60, 180, 600, 1800, 3600, 7200, 14400, 28800, 86400];
    return intervals[Math.min(level, intervals.length - 1)];
  }

  setPriorityWords(words: WordEntry[]): void {
    if (words.length === 0) return;
    const existingEns = new Set(this.words.map(w => w.en));
    const newWords = words.filter(w => !existingEns.has(w.en));
    this.words = [...newWords, ...this.words];
    this.currentIndex = 0;
  }

  loadCustomWords(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) return false;

      const customWords: WordEntry[] = parsed
        .filter(item => item.en && item.zh)
        .map(item => ({
          en: item.en,
          zh: item.zh,
          distractors: item.distractors || item.distractor1 ? [item.distractor1 || '选项A', item.distractor2 || '选项B'] : ['选项A', '选项B'],
        }));

      if (customWords.length === 0) return false;
      this.words = customWords;
      this.currentIndex = 0;
      this.reviewMap.clear();
      this.reviewQueue = [];
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  shuffle(): void {
    for (let i = this.words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.words[i], this.words[j]] = [this.words[j], this.words[i]];
    }
  }

  getStats(): { total: number; mastered: number; learning: number } {
    let mastered = 0;
    let learning = 0;
    for (const review of this.reviewMap.values()) {
      if (review.srsLevel >= 4) mastered++;
      else if (review.srsLevel > 0) learning++;
    }
    return { total: this.words.length, mastered, learning };
  }

  getChoices(word: WordEntry): string[] {
    const others = this.words.filter(w => w.en !== word.en);
    const shuffled = others.sort(() => Math.random() - 0.5);
    const distractors = word.distractors.length >= 2
      ? word.distractors.slice(0, 2)
      : shuffled.slice(0, 2).map(w => w.zh);
    const choices = [word.zh, ...distractors];
    return choices.sort(() => Math.random() - 0.5);
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem('lexi_strike_words');
      if (data) {
        const parsed = JSON.parse(data);
        this.reviewMap = new Map(Object.entries(parsed.reviewMap || {}));
        this.reviewQueue = parsed.reviewQueue || [];
        this.currentIndex = parsed.currentIndex || 0;

        const customWords = parsed.customWords;
        if (customWords && Array.isArray(customWords)) {
          this.words = customWords;
        }
      }
    } catch { /* ignore */ }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('lexi_strike_words', JSON.stringify({
        reviewMap: Object.fromEntries(this.reviewMap),
        reviewQueue: this.reviewQueue,
        currentIndex: this.currentIndex,
        customWords: this.words,
      }));
    } catch { /* ignore */ }
  }
}