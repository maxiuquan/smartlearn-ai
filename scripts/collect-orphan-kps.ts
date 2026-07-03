/**
 * 收集所有孤立知识点ID，显示每个ID的第一个题目主题
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
    if (data.chapters) {
      for (const ch of data.chapters) {
        if (ch.sections) {
          for (const sec of ch.sections) {
            if (sec.points) {
              for (const pt of sec.points) ids.add(pt.id);
            }
          }
        }
      }
    }
    if (data.points) {
      for (const pt of data.points) ids.add(pt.id);
    }
  }
  return ids;
}

// 找孤立知识点ID及其对应题目信息
function findOrphanKPs() {
  const kpIds = collectKnowledgePointIds();
  const questionsDir = path.join(DATA_DIR, 'questions');
  const orphanMap = new Map<string, { questionId: string; chapter: string; section: string; title: string; count: number }>();

  for (const file of fs.readdirSync(questionsDir)) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(questionsDir, file), 'utf-8'));
    const questions = Array.isArray(data) ? data : (data.questions || []);
    for (const q of questions) {
      if (q.knowledge_points && Array.isArray(q.knowledge_points)) {
        for (const kpId of q.knowledge_points) {
          if (!kpIds.has(kpId)) {
            if (!orphanMap.has(kpId)) {
              orphanMap.set(kpId, {
                questionId: q.id,
                chapter: q.chapter || '',
                section: q.section || '',
                title: q.title || '',
                count: 0,
              });
            }
            orphanMap.get(kpId)!.count++;
          }
        }
      }
    }
  }
  return orphanMap;
}

const orphanMap = findOrphanKPs();
console.log(`发现 ${orphanMap.size} 个孤立知识点ID:\n`);

// 按ID排序输出
const sorted = [...orphanMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [kpId, info] of sorted) {
  console.log(`  ${kpId} (${info.count}次) → ${info.chapter} / ${info.section} / ${info.title}`);
}