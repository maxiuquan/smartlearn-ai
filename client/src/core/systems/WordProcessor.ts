import type { RootInfo } from '../models/Vocabulary';
import type { Word } from '../models/Vocabulary';

const COMMON_ROOTS: RootInfo[] = [
  { name: 'un-', meaning: '不，相反', type: 'prefix', examples: ['unable', 'unfair', 'unlock'] },
  { name: 're-', meaning: '再次，返回', type: 'prefix', examples: ['return', 'review', 'rebuild'] },
  { name: 'in-', meaning: '不，向内', type: 'prefix', examples: ['inactive', 'inside', 'incomplete'] },
  { name: 'im-', meaning: '不，向内', type: 'prefix', examples: ['impossible', 'import', 'immature'] },
  { name: 'dis-', meaning: '不，相反', type: 'prefix', examples: ['disagree', 'dislike', 'disappear'] },
  { name: 'pre-', meaning: '在...之前', type: 'prefix', examples: ['preview', 'predict', 'prepare'] },
  { name: 'mis-', meaning: '错误', type: 'prefix', examples: ['mistake', 'misunderstand', 'mislead'] },
  { name: 'sub-', meaning: '在...下面', type: 'prefix', examples: ['subway', 'submarine', 'subtitle'] },
  { name: 'inter-', meaning: '在...之间', type: 'prefix', examples: ['international', 'interact', 'internet'] },
  { name: 'trans-', meaning: '跨越，转变', type: 'prefix', examples: ['transport', 'transform', 'translate'] },
  { name: 'super-', meaning: '超级，在上', type: 'prefix', examples: ['superman', 'supermarket', 'supervise'] },
  { name: 'anti-', meaning: '反对，对抗', type: 'prefix', examples: ['antibody', 'antisocial', 'antiwar'] },
  { name: 'auto-', meaning: '自动，自身', type: 'prefix', examples: ['automatic', 'automobile', 'autograph'] },
  { name: 'micro-', meaning: '微小', type: 'prefix', examples: ['microscope', 'microphone', 'microbe'] },
  { name: 'multi-', meaning: '多个', type: 'prefix', examples: ['multiply', 'multicolor', 'multimedia'] },
  { name: 'over-', meaning: '过度，在上', type: 'prefix', examples: ['overcome', 'overlook', 'overflow'] },
  { name: 'under-', meaning: '在...下，不足', type: 'prefix', examples: ['underline', 'understand', 'underestimate'] },
  { name: 'semi-', meaning: '一半', type: 'prefix', examples: ['semifinal', 'semicircle', 'semiannual'] },
  { name: 'mid-', meaning: '中间', type: 'prefix', examples: ['midnight', 'midway', 'midsummer'] },
  //
  { name: 'spect', meaning: '看', type: 'root', examples: ['inspect', 'respect', 'spectacle'] },
  { name: 'dict', meaning: '说', type: 'root', examples: ['dictate', 'predict', 'dictionary'] },
  { name: 'port', meaning: '携带，运送', type: 'root', examples: ['transport', 'export', 'portable'] },
  { name: 'struct', meaning: '建造', type: 'root', examples: ['construct', 'structure', 'instruct'] },
  { name: 'scrib', meaning: '写', type: 'root', examples: ['describe', 'subscribe', 'manuscript'] },
  { name: 'script', meaning: '写', type: 'root', examples: ['transcript', 'prescription', 'manuscript'] },
  { name: 'tract', meaning: '拉，拖', type: 'root', examples: ['attract', 'contract', 'extract'] },
  { name: 'cept', meaning: '拿，取', type: 'root', examples: ['accept', 'concept', 'except'] },
  { name: 'capt', meaning: '拿，抓', type: 'root', examples: ['capture', 'captive', 'caption'] },
  { name: 'mit', meaning: '发送', type: 'root', examples: ['transmit', 'submit', 'commit'] },
  { name: 'miss', meaning: '发送', type: 'root', examples: ['mission', 'dismiss', 'permission'] },
  { name: 'graph', meaning: '写，画', type: 'root', examples: ['graphic', 'biography', 'photograph'] },
  { name: 'phon', meaning: '声音', type: 'root', examples: ['telephone', 'microphone', 'symphony'] },
  { name: 'aud', meaning: '听', type: 'root', examples: ['audio', 'audience', 'auditorium'] },
  { name: 'bio', meaning: '生命', type: 'root', examples: ['biology', 'biography', 'antibiotic'] },
  { name: 'geo', meaning: '地球，土地', type: 'root', examples: ['geography', 'geology', 'geometry'] },
  { name: 'chron', meaning: '时间', type: 'root', examples: ['chronic', 'chronology', 'synchronize'] },
  { name: 'therm', meaning: '热', type: 'root', examples: ['thermal', 'thermometer', 'hypothermia'] },
  { name: 'hydr', meaning: '水', type: 'root', examples: ['hydrate', 'dehydrate', 'hydroelectric'] },
  { name: 'path', meaning: '感觉，疾病', type: 'root', examples: ['sympathy', 'pathology', 'empathy'] },
  { name: 'psych', meaning: '心灵', type: 'root', examples: ['psychology', 'psychic', 'psychiatry'] },
  { name: 'tele', meaning: '远距离', type: 'root', examples: ['television', 'telephone', 'teleport'] },
  { name: 'cycl', meaning: '圆，环', type: 'root', examples: ['bicycle', 'cycle', 'recycle'] },
  { name: 'cred', meaning: '相信', type: 'root', examples: ['credit', 'incredible', 'credentials'] },
  { name: 'rupt', meaning: '打破', type: 'root', examples: ['erupt', 'disrupt', 'interrupt'] },
  { name: 'ject', meaning: '投掷', type: 'root', examples: ['inject', 'project', 'reject'] },
  { name: 'vid', meaning: '看', type: 'root', examples: ['video', 'evidence', 'provide'] },
  { name: 'vis', meaning: '看', type: 'root', examples: ['vision', 'visible', 'revise'] },
  //
  { name: '-tion', meaning: '名词后缀（动作/状态）', type: 'suffix', examples: ['action', 'education', 'creation'] },
  { name: '-sion', meaning: '名词后缀（动作/状态）', type: 'suffix', examples: ['decision', 'version', 'explosion'] },
  { name: '-able', meaning: '能够...的', type: 'suffix', examples: ['readable', 'comfortable', 'usable'] },
  { name: '-ible', meaning: '能够...的', type: 'suffix', examples: ['possible', 'flexible', 'visible'] },
  { name: '-ous', meaning: '充满...的', type: 'suffix', examples: ['famous', 'dangerous', 'curious'] },
  { name: '-ive', meaning: '有...倾向的', type: 'suffix', examples: ['active', 'creative', 'attractive'] },
  { name: '-ful', meaning: '充满...的', type: 'suffix', examples: ['beautiful', 'helpful', 'powerful'] },
  { name: '-less', meaning: '没有...的', type: 'suffix', examples: ['endless', 'careless', 'homeless'] },
  { name: '-ment', meaning: '名词后缀（状态/结果）', type: 'suffix', examples: ['movement', 'agreement', 'development'] },
  { name: '-ness', meaning: '名词后缀（性质/状态）', type: 'suffix', examples: ['happiness', 'darkness', 'kindness'] },
  { name: '-ity', meaning: '名词后缀（性质/状态）', type: 'suffix', examples: ['ability', 'reality', 'creativity'] },
  { name: '-al', meaning: '...的，与...相关', type: 'suffix', examples: ['personal', 'natural', 'cultural'] },
  { name: '-ic', meaning: '...的，与...相关', type: 'suffix', examples: ['heroic', 'scientific', 'classic'] },
  { name: '-er', meaning: '做...的人/物', type: 'suffix', examples: ['teacher', 'worker', 'computer'] },
  { name: '-or', meaning: '做...的人/物', type: 'suffix', examples: ['actor', 'inventor', 'professor'] },
  { name: '-ly', meaning: '以...方式', type: 'suffix', examples: ['quickly', 'slowly', 'friendly'] },
  { name: '-ize', meaning: '使...化', type: 'suffix', examples: ['realize', 'organize', 'specialize'] },
  { name: '-logy', meaning: '...学', type: 'suffix', examples: ['biology', 'geology', 'technology'] },
  { name: '-ence', meaning: '名词后缀（状态/性质）', type: 'suffix', examples: ['difference', 'confidence', 'existence'] },
  { name: '-ance', meaning: '名词后缀（状态/性质）', type: 'suffix', examples: ['importance', 'appearance', 'distance'] },
];

export class WordProcessor {
  private sortedPrefixes: RootInfo[];
  private sortedSuffixes: RootInfo[];
  private sortedRoots: RootInfo[];

  constructor() {
    this.sortedPrefixes = COMMON_ROOTS
      .filter((r) => r.type === 'prefix')
      .sort((a, b) => b.name.length - a.name.length);
    this.sortedSuffixes = COMMON_ROOTS
      .filter((r) => r.type === 'suffix')
      .sort((a, b) => b.name.length - a.name.length);
    this.sortedRoots = COMMON_ROOTS
      .filter((r) => r.type === 'root')
      .sort((a, b) => b.name.length - a.name.length);
  }

  decomposeWord(word: string): {
    prefix: string;
    roots: string[];
    suffix: string;
  } {
    const lower = word.toLowerCase();
    let remaining = lower;
    let prefix = '';

    for (const p of this.sortedPrefixes) {
      const name = p.name.replace('-', '');
      if (remaining.startsWith(name) && remaining.length > name.length + 1) {
        prefix = name;
        remaining = remaining.slice(name.length);
        break;
      }
    }

    let suffix = '';
    for (const s of this.sortedSuffixes) {
      const name = s.name.replace('-', '');
      if (remaining.endsWith(name) && remaining.length > name.length + 1) {
        suffix = name;
        remaining = remaining.slice(0, remaining.length - name.length);
        break;
      }
    }

    const roots: string[] = [];
    let rootRemaining = remaining;

    for (const r of this.sortedRoots) {
      const idx = rootRemaining.indexOf(r.name);
      if (idx !== -1) {
        roots.push(r.name);
        rootRemaining = rootRemaining.replace(r.name, '');
      }
    }

    return { prefix, roots, suffix };
  }

  findRelatedWords(word: string, wordList: Word[]): Word[] {
    const decomposition = this.decomposeWord(word);
    const related: Word[] = [];

    const hasMatch = (target: string, candidate: string): boolean => {
      if (!target || !candidate) return false;
      return candidate.includes(target);
    };

    for (const w of wordList) {
      if (w.text.toLowerCase() === word.toLowerCase()) continue;

      const otherDecomp = this.decomposeWord(w.text);

      let shareRoot = false;
      for (const root of decomposition.roots) {
        if (otherDecomp.roots.includes(root)) {
          shareRoot = true;
          break;
        }
      }

      const sharePrefix =
        decomposition.prefix !== '' &&
        decomposition.prefix === otherDecomp.prefix;
      const shareSuffix =
        decomposition.suffix !== '' &&
        decomposition.suffix === otherDecomp.suffix;

      const shareRootInText =
        decomposition.roots.length > 0 &&
        decomposition.roots.some((root) => hasMatch(root, w.text.toLowerCase()));

      if (shareRoot || sharePrefix || shareSuffix || shareRootInText) {
        related.push(w);
      }
    }

    return related;
  }

  getRootGroup(words: Word[]): Map<string, Word[]> {
    const groups = new Map<string, Word[]>();

    for (const word of words) {
      const decomp = this.decomposeWord(word.text);

      const allMorphemes = [
        ...(decomp.prefix ? [decomp.prefix] : []),
        ...decomp.roots,
        ...(decomp.suffix ? [decomp.suffix] : []),
      ];

      for (const morpheme of allMorphemes) {
        const existing = groups.get(morpheme);
        if (existing) {
          existing.push(word);
        } else {
          groups.set(morpheme, [word]);
        }
      }
    }

    return groups;
  }

  getDifficultyLabel(level: number): string {
    switch (level) {
      case 1:
        return '入门';
      case 2:
        return '基础';
      case 3:
        return '进阶';
      case 4:
        return '高阶';
      case 5:
        return '大师';
      default:
        return '未知';
    }
  }

  static getAllRoots(): RootInfo[] {
    return [...COMMON_ROOTS];
  }

  static getRootsByType(type: 'prefix' | 'root' | 'suffix'): RootInfo[] {
    return COMMON_ROOTS.filter((r) => r.type === type);
  }
}