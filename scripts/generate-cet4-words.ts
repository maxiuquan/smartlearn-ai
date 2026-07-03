import * as fs from 'fs';
import * as https from 'https';

// 从 GitHub 获取四级词表 txt
const URL = 'https://raw.githubusercontent.com/wamich/english-vocabulary/master/3%20%E5%9B%9B%E7%BA%A7-%E4%B9%B1%E5%BA%8F.txt';

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

function guessPartOfSpeech(word: string, def: string): string {
  const d = def.toLowerCase();
  if (d.startsWith('v.') || d.startsWith('v ') || d.startsWith('vt.') || d.startsWith('vi.')) return 'v.';
  if (d.startsWith('n.') || d.startsWith('n ')) return 'n.';
  if (d.startsWith('adj.') || d.startsWith('adj ')) return 'adj.';
  if (d.startsWith('adv.') || d.startsWith('adv ')) return 'adv.';
  if (d.startsWith('prep.')) return 'prep.';
  if (d.startsWith('conj.')) return 'conj.';
  if (d.startsWith('pron.')) return 'pron.';
  if (d.startsWith('num.')) return 'num.';
  if (d.startsWith('art.')) return 'art.';
  if (d.startsWith('int.')) return 'int.';
  if (d.startsWith('det.')) return 'det.';
  
  // 根据常见后缀猜测
  if (word.endsWith('tion') || word.endsWith('sion') || word.endsWith('ment') || 
      word.endsWith('ness') || word.endsWith('ity') || word.endsWith('ence') ||
      word.endsWith('ance') || word.endsWith('er') || word.endsWith('or') ||
      word.endsWith('ist') || word.endsWith('ism')) return 'n.';
  if (word.endsWith('ive') || word.endsWith('ous') || word.endsWith('ful') ||
      word.endsWith('less') || word.endsWith('able') || word.endsWith('ible') ||
      word.endsWith('al') || word.endsWith('ic') || word.endsWith('ent') ||
      word.endsWith('ant') || word.endsWith('ary') || word.endsWith('ed')) return 'adj.';
  if (word.endsWith('ly')) return 'adv.';
  if (word.endsWith('ize') || word.endsWith('ise') || word.endsWith('ate') ||
      word.endsWith('ify') || word.endsWith('en')) return 'v.';
  return 'n.';
}

function guessDifficulty(word: string): string {
  if (word.length <= 4) return 'easy';
  if (word.length <= 7) return 'medium';
  return 'hard';
}

function generatePhonetic(word: string): string {
  // 简单生成音标格式
  return `/${word}/`;
}

function generateSentence(word: string, def: string): string {
  const cleanDef = def.replace(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|art\.|int\.|det\.)\s*/, '');
  const shortDef = cleanDef.split(/[；;，,]/)[0].trim();
  return `Learning the word '${word}' — ${shortDef}.`;
}

async function main() {
  console.log('正在获取四级词表...');
  const raw = await fetch(URL);
  const lines = raw.split('\n').filter(l => l.trim());
  
  console.log(`共获取 ${lines.length} 行原始数据`);
  
  const words: string[] = [];
  const seen = new Set<string>();
  
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    const word = parts[0].trim().toLowerCase();
    const definition = parts.slice(1).join(' ').trim();
    
    if (!word || word.length < 2 || word.includes(' ')) continue;
    if (seen.has(word)) continue;
    
    seen.add(word);
    const pos = guessPartOfSpeech(word, definition);
    const difficulty = guessDifficulty(word);
    const phonetic = generatePhonetic(word);
    const sentence = generateSentence(word, definition);
    
    // 转义定义中的引号
    const escapedDef = definition.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedSent = sentence.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    
    const entry = `  { word: '${word}', phonetic: '${phonetic}', definition: '${escapedDef}', exampleSentence: '${escapedSent}', partOfSpeech: '${pos}', difficulty: '${difficulty}', category: 'CET4核心词' }`;
    words.push(entry);
  }
  
  console.log(`处理后共 ${words.length} 个单词`);
  
  // 生成 TypeScript 文件内容
  const tsContent = `export const CET4_CORE_WORDS = [
${words.join(',\n')},
];
`;
  
  fs.writeFileSync('server/src/data/english-words-cet4.ts', tsContent, 'utf-8');
  console.log('已生成 server/src/data/english-words-cet4.ts');
}

main().catch(console.error);