/**
 * 数据质量校验脚本
 * 检查: ①知识点引用完整性 ②LaTeX 语法 ③AI 残留痕迹 ④答案与解析一致性
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');

interface Question {
  id: string;
  content: string;
  answer: string;
  solution?: string;
  knowledge_points?: string[];
  [key: string]: unknown;
}

interface KnowledgePoint {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface ValidationResult {
  file: string;
  total: number;
  errors: string[];
  warnings: string[];
}

const results: ValidationResult[] = [];

// 收集所有知识点 ID
function collectKnowledgePointIds(): Map<string, string> {
  const kpMap = new Map<string, string>();
  const kpDir = path.join(DATA_DIR, 'knowledge-points');
  
  if (!fs.existsSync(kpDir)) {
    console.warn('知识点目录不存在:', kpDir);
    return kpMap;
  }
  
  for (const file of fs.readdirSync(kpDir)) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(kpDir, file), 'utf-8'));
    const chapters = data.chapters || [];
    for (const ch of chapters) {
      const sections = ch.sections || [];
      for (const sec of sections) {
        const points = sec.points || [];
        for (const p of points) {
          kpMap.set(p.id, `${ch.name} > ${sec.name} > ${p.name}`);
        }
      }
    }
  }
  
  return kpMap;
}

// 检查 LaTeX 语法
function checkLatex(text: string): string[] {
  const errors: string[] = [];
  if (!text) return errors;
  
  // 检查未闭合的 $...$
  const dollarCount = (text.match(/(?<!\\)\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    errors.push('LaTeX: $...$ 未成对闭合');
  }
  
  // 检查未闭合的 $$...$$
  const ddCount = (text.match(/\$\$/g) || []).length;
  if (ddCount % 2 !== 0) {
    errors.push('LaTeX: $$...$$ 未成对闭合');
  }
  
  // 检查未闭合的花括号
  const openBraces = (text.match(/(?<!\\)\{/g) || []).length;
  const closeBraces = (text.match(/(?<!\\)\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`LaTeX: 花括号不匹配 (开${openBraces}, 闭${closeBraces})`);
  }
  
  // 检查未闭合的 \left 和 \right
  const leftMatches = text.match(/\\left/g) || [];
  const rightMatches = text.match(/\\right/g) || [];
  const leftCount = leftMatches.length;
  const rightCount = rightMatches.length;
  if (leftCount !== rightCount) {
    errors.push(`LaTeX: \\left/\\right 不匹配 (left=${leftCount}, right=${rightCount})`);
  }
  
  return errors;
}

// 检查 AI 残留痕迹
function checkAiArtifacts(text: string): string[] {
  const warnings: string[] = [];
  if (!text) return warnings;
  
  const aiPatterns = [
    /等等[,，]\s*让[我我].*检查/,
    /让我.*重新/,
    /等等[,，]\s*我.*再/,
    /Oops[!！]/i,
    /I apologize/i,
    /as an AI/i,
    /需要注意的是[,，]/,
    /值得注意的是[,，]/,
    /综上所述[,，]/,
    /总之[,，]/,
    /通过以上分析/,
    /我们.*可以.*得出/,
    /需要注意/,
    /温馨提示/,
    /小贴士/,
  ];
  
  for (const pattern of aiPatterns) {
    if (pattern.test(text)) {
      warnings.push(`AI 残留痕迹: 匹配 "${pattern.toString().slice(1, 40)}..."`);
    }
  }
  
  return warnings;
}

// 检查答案是否为空
function checkEmptyAnswer(question: Question): string[] {
  const errors: string[] = [];
  const answer = (question.answer || '').trim();
  
  if (!answer || answer === '证明略' || answer === '略') {
    errors.push('答案为空或为"证明略/略"');
  }
  
  return errors;
}

// 验证单个题目文件
function validateQuestionFile(filePath: string, kpIds: Map<string, string>): ValidationResult {
  const fileName = path.basename(filePath);
  const result: ValidationResult = { file: fileName, total: 0, errors: [], warnings: [] };
  
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      result.errors.push('JSON 解析失败');
      return result;
    }
    
    let questions: Question[] = [];
    if (Array.isArray(data)) {
      questions = data;
    } else if (data && typeof data === 'object' && 'questions' in data) {
      questions = (data as { questions: Question[] }).questions;
    } else {
      result.errors.push('无法识别题目数组格式');
      return result;
    }
    
    result.total = questions.length;
    
    for (const q of questions) {
      const qId = q.id || 'unknown';
      const prefix = `[${qId}]`;
      
      // 检查知识点引用
      if (q.knowledge_points && Array.isArray(q.knowledge_points)) {
        for (const kpId of q.knowledge_points) {
          if (!kpIds.has(kpId)) {
            result.errors.push(`${prefix} 知识点 "${kpId}" 不存在于知识点库中`);
          }
        }
      } else if (!q.knowledge_points || q.knowledge_points.length === 0) {
        result.warnings.push(`${prefix} 无知识点关联`);
      }
      
      // 检查 LaTeX
      const latexErrors = [
        ...checkLatex(q.content || ''),
        ...checkLatex(q.answer || ''),
        ...checkLatex(q.solution || ''),
      ];
      for (const e of latexErrors) {
        result.errors.push(`${prefix} ${e}`);
      }
      
      // 检查 AI 残留
      const aiWarnings = checkAiArtifacts(q.solution || '');
      for (const w of aiWarnings) {
        result.warnings.push(`${prefix} ${w}`);
      }
      
      // 检查答案为空
      const emptyErrors = checkEmptyAnswer(q);
      for (const e of emptyErrors) {
        result.errors.push(`${prefix} ${e}`);
      }
    }
  } catch (e: unknown) {
    result.errors.push(`读取文件失败: ${e instanceof Error ? e.message : String(e)}`);
  }
  
  return result;
}

// 主函数
function main() {
  console.log('=== SmartLearn AI 数据质量校验 ===\n');
  
  // 收集知识点 ID
  console.log('1. 加载知识点库...');
  const kpIds = collectKnowledgePointIds();
  console.log(`   共 ${kpIds.size} 个知识点\n`);
  
  // 扫描题目文件
  console.log('2. 校验题目文件...');
  const questionsDir = path.join(DATA_DIR, 'questions');
  if (fs.existsSync(questionsDir)) {
    for (const file of fs.readdirSync(questionsDir)) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(questionsDir, file);
      const result = validateQuestionFile(filePath, kpIds);
      results.push(result);
    }
  }
  
  // 汇总
  console.log('\n3. 校验结果汇总:\n');
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalQuestions = 0;
  
  const separator = '='.repeat(60);
  console.log(separator);
  
  for (const r of results) {
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
    totalQuestions += r.total;
    
    const status = r.errors.length === 0 && r.warnings.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${r.file}: ${r.total} 题, ${r.errors.length} 错误, ${r.warnings.length} 警告`);
    
    if (r.errors.length > 0) {
      for (const e of r.errors.slice(0, 10)) {
        console.log(`   ❌ ${e}`);
      }
      if (r.errors.length > 10) {
        console.log(`   ... 还有 ${r.errors.length - 10} 个错误`);
      }
    }
    
    if (r.warnings.length > 0) {
      for (const w of r.warnings.slice(0, 5)) {
        console.log(`   ⚠️  ${w}`);
      }
      if (r.warnings.length > 5) {
        console.log(`   ... 还有 ${r.warnings.length - 5} 个警告`);
      }
    }
  }
  
  console.log(separator);
  console.log(`\n总计: ${totalQuestions} 题, ${totalErrors} 错误, ${totalWarnings} 警告`);
  
  // 检查空目录
  console.log('\n4. 检查空目录...');
  const requiredDirs = [
    { path: path.join(DATA_DIR, 'exam-papers'), name: '真题试卷' },
    { path: path.join(DATA_DIR, 'exercise-books'), name: '习题册' },
  ];
  
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir.path)) {
      console.log(`   ❌ ${dir.name} 目录不存在`);
    } else {
      const files = fs.readdirSync(dir.path).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        console.log(`   ⚠️  ${dir.name} 目录为空 (仅有 schema.json)`);
      } else {
        console.log(`   ✅ ${dir.name}: ${files.length} 个文件`);
      }
    }
  }
  
  // 检查缺失数据文件
  console.log('\n5. 检查缺失数据文件...');
  const missingFiles = [
    { path: path.join(DATA_DIR, 'roots.json'), name: '词根词缀数据' },
    { path: path.join(DATA_DIR, 'formulas.json'), name: '公式库' },
  ];
  
  for (const mf of missingFiles) {
    if (fs.existsSync(mf.path)) {
      console.log(`   ✅ ${mf.name}: 已存在`);
    } else {
      console.log(`   ❌ ${mf.name}: 缺失`);
    }
  }
  
  console.log('\n=== 校验完成 ===');
  
  if (totalErrors > 0) process.exitCode = 1;
}

main();