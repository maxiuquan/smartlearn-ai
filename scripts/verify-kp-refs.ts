/**
 * 验证知识点引用完整性
 * 检查所有题目中引用的 knowledge_points 是否都能在知识点库中找到
 */
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');

// 收集所有知识点 ID
function collectKnowledgePointIds(): Set<string> {
  const ids = new Set<string>();
  const kpDir = path.join(DATA_DIR, 'knowledge-points');

  for (const file of fs.readdirSync(kpDir)) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(kpDir, file), 'utf-8'));

    // 处理 chapters 结构
    if (data.chapters) {
      for (const ch of data.chapters) {
        if (ch.sections) {
          for (const sec of ch.sections) {
            if (sec.points) {
              for (const pt of sec.points) {
                ids.add(pt.id);
              }
            }
          }
        }
      }
    }

    // 处理 points 直接结构
    if (data.points) {
      for (const pt of data.points) {
        ids.add(pt.id);
      }
    }
  }

  return ids;
}

// 收集题目中引用的知识点 ID
function collectQuestionKPRefs(): Map<string, string[]> {
  const refs = new Map<string, string[]>(); // questionId -> kpIds
  const questionsDir = path.join(DATA_DIR, 'questions');

  for (const file of fs.readdirSync(questionsDir)) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(questionsDir, file), 'utf-8'));

    const questions = Array.isArray(data) ? data : (data.questions || []);
    for (const q of questions) {
      if (q.knowledge_points && Array.isArray(q.knowledge_points)) {
        refs.set(q.id, q.knowledge_points);
      }
    }
  }

  return refs;
}

function main() {
  console.log('=== 知识点引用完整性验证 ===\n');

  const kpIds = collectKnowledgePointIds();
  console.log(`[知识点库] 共 ${kpIds.size} 个知识点ID`);
  console.log(`  示例: ${[...kpIds].slice(0, 5).join(', ')}...\n`);

  const questionRefs = collectQuestionKPRefs();
  console.log(`[题目库] 共 ${questionRefs.size} 道题目引用了知识点\n`);

  // 检查孤立引用
  const orphanRefs: { questionId: string; kpIds: string[] }[] = [];
  let totalRefs = 0;
  let validRefs = 0;

  for (const [qId, refIds] of questionRefs) {
    totalRefs += refIds.length;
    const missing = refIds.filter(refId => !kpIds.has(refId));
    if (missing.length > 0) {
      orphanRefs.push({ questionId: qId, kpIds: missing });
    }
    validRefs += refIds.length - missing.length;
  }

  if (orphanRefs.length > 0) {
    console.log(`❌ 发现 ${orphanRefs.length} 道题目存在孤立引用:\n`);
    for (const { questionId, kpIds } of orphanRefs) {
      console.log(`  题目 ${questionId}: 引用了不存在的知识点: ${kpIds.join(', ')}`);
    }
  } else {
    console.log(`✅ 所有知识点引用均有效！`);
  }

  console.log(`\n[统计] 总引用: ${totalRefs}, 有效: ${validRefs}, 孤立: ${totalRefs - validRefs}`);
  console.log(`[覆盖率] ${((validRefs / totalRefs) * 100).toFixed(1)}%`);
}

main();