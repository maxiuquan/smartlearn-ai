import { Router } from 'express';
import { prisma } from '../db';

export const wordImportRoutes = Router();

interface ParsedWord {
  word: string;
  phonetic?: string;
  definition: string;
  exampleSentence?: string;
  partOfSpeech?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
}

function normalizeDifficulty(d: string | undefined): 'easy' | 'medium' | 'hard' {
  if (!d) return 'medium';
  const low = d.toLowerCase().trim();
  if (low === '1' || low === 'easy' || low === '入门' || low === '基础' || low === '简单') return 'easy';
  if (low === '2' || low === 'medium' || low === '进阶' || low === '中等' || low === '中') return 'medium';
  if (low === '3' || low === 'hard' || low === '高阶' || low === '困难' || low === '难' || low === '5') return 'hard';
  return 'medium';
}

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  });
}

function parseJSON(content: string): ParsedWord[] {
  const data = JSON.parse(content);
  if (Array.isArray(data)) {
    return data.map((item: Record<string, unknown>) => ({
      word: String(item.word || item.text || '').trim(),
      phonetic: item.phonetic ? String(item.phonetic) : undefined,
      definition: String(item.definition || item.meaning || '').trim(),
      exampleSentence: item.exampleSentence || item.example ? String(item.exampleSentence || item.example) : undefined,
      partOfSpeech: item.partOfSpeech || item.pos ? String(item.partOfSpeech || item.pos) : undefined,
      difficulty: normalizeDifficulty(String(item.difficulty || 'medium')),
      category: String(item.category || '考研英语'),
    })).filter(w => w.word && w.definition);
  }
  return [];
}

function parseAnkiTXT(content: string): ParsedWord[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const words: ParsedWord[] = [];
  for (const line of lines) {
    const idx = line.indexOf('\t');
    if (idx === -1) continue;
    const front = line.substring(0, idx).trim();
    const back = line.substring(idx + 1).trim();
    const phoneticMatch = front.match(/^\[(.+?)\]\s*/);
    let word = front;
    let phonetic: string | undefined;
    if (phoneticMatch) {
      phonetic = phoneticMatch[1];
      word = front.replace(phoneticMatch[0], '').trim();
    }
    if (!word) continue;
    const meaningMatch = back.match(/^([^.]+?)(?:\.|$)/);
    const definition = meaningMatch ? meaningMatch[1].trim() : back;
    words.push({
      word,
      phonetic,
      definition,
      difficulty: 'medium',
      category: '考研英语',
    });
  }
  return words;
}

function detectFormat(content: string, filename: string): 'csv' | 'json' | 'anki' {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.txt') || lower.endsWith('.tsv') || lower.endsWith('.anki')) return 'anki';
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return 'json';
  if (trimmed.includes('\t')) return 'anki';
  return 'csv';
}

wordImportRoutes.post('/preview', async (req, res) => {
  try {
    const { content, filename = 'words.csv' } = req.body as { content: string; filename?: string };
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: '缺少内容' });
    }
    const format = detectFormat(content, filename);
    let words: ParsedWord[] = [];
    if (format === 'json') {
      words = parseJSON(content);
    } else if (format === 'anki') {
      words = parseAnkiTXT(content);
    } else {
      const rows = parseCSV(content);
      if (rows.length === 0) {
        return res.json({ format, total: 0, sample: [], errors: [] });
      }
      const headerRow = rows[0].map(h => h.toLowerCase());
      const hasHeader = headerRow.some(h => ['word', 'text', '单词', '词', 'term'].includes(h));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const colMap: Record<string, number> = {};
      if (hasHeader) {
        headerRow.forEach((h, i) => {
          if (['word', 'text', '单词', '词', 'term'].includes(h)) colMap.word = i;
          else if (['phonetic', '音标', 'pronunciation'].includes(h)) colMap.phonetic = i;
          else if (['definition', 'meaning', 'definition_cn', '释义', '意思', '翻译'].includes(h)) colMap.definition = i;
          else if (['example', 'examplesentence', 'example_sentence', '例句'].includes(h)) colMap.example = i;
          else if (['pos', 'partofspeech', '词性'].includes(h)) colMap.pos = i;
          else if (['difficulty', '难度', 'level'].includes(h)) colMap.difficulty = i;
          else if (['category', '分类', 'category_name'].includes(h)) colMap.category = i;
        });
      } else {
        colMap.word = 0; colMap.definition = 1;
        if (dataRows[0] && dataRows[0].length > 2) colMap.example = 2;
      }
      const errors: { line: number; reason: string }[] = [];
      words = dataRows.map((row, idx) => {
        const w = (row[colMap.word] || '').trim();
        const d = (row[colMap.definition] || '').trim();
        if (!w) {
          errors.push({ line: idx + (hasHeader ? 2 : 1), reason: '缺少单词' });
          return null;
        }
        if (!d) {
          errors.push({ line: idx + (hasHeader ? 2 : 1), reason: '缺少释义' });
          return null;
        }
        return {
          word: w,
          phonetic: colMap.phonetic !== undefined ? (row[colMap.phonetic] || '').trim() : undefined,
          definition: d,
          exampleSentence: colMap.example !== undefined ? (row[colMap.example] || '').trim() : undefined,
          partOfSpeech: colMap.pos !== undefined ? (row[colMap.pos] || '').trim() : undefined,
          difficulty: normalizeDifficulty(colMap.difficulty !== undefined ? row[colMap.difficulty] : undefined),
          category: colMap.category !== undefined ? (row[colMap.category] || '考研英语').trim() : '考研英语',
        } as ParsedWord;
      }).filter((w): w is ParsedWord => w !== null);
    }

    const unique = new Map<string, ParsedWord>();
    for (const w of words) {
      const key = w.word.toLowerCase();
      if (!unique.has(key)) unique.set(key, w);
    }
    const deduped = Array.from(unique.values());
    const existingWords = await prisma.word.findMany({
      where: { word: { in: deduped.map(w => w.word) } },
      select: { word: true },
    });
    const existingSet = new Set(existingWords.map(w => w.word.toLowerCase()));
    const toImport = deduped.filter(w => !existingSet.has(w.word.toLowerCase()));
    const duplicates = deduped.length - toImport.length;

    res.json({
      format,
      total: deduped.length,
      newCount: toImport.length,
      duplicateCount: duplicates,
      sample: toImport.slice(0, 5),
      errors: words.length === 0 ? [{ line: 0, reason: '未能解析出任何有效单词' }] : [],
    });
  } catch (error) {
    console.error('预览失败', error);
    res.status(500).json({ error: '预览失败：' + (error as Error).message });
  }
});

wordImportRoutes.post('/import', async (req, res) => {
  try {
    const { content, filename = 'words.csv', skipExisting = true } = req.body as { content: string; filename?: string; skipExisting?: boolean };
    if (!content) {
      return res.status(400).json({ error: '缺少内容' });
    }
    const format = detectFormat(content, filename);
    let words: ParsedWord[] = [];
    if (format === 'json') {
      words = parseJSON(content);
    } else if (format === 'anki') {
      words = parseAnkiTXT(content);
    } else {
      const rows = parseCSV(content);
      if (rows.length === 0) {
        return res.json({ imported: 0, skipped: 0, failed: 0 });
      }
      const headerRow = rows[0].map(h => h.toLowerCase());
      const hasHeader = headerRow.some(h => ['word', 'text', '单词', '词'].includes(h));
      const dataRows = hasHeader ? rows.slice(1) : rows;
      const colMap: Record<string, number> = { word: 0, definition: 1 };
      if (hasHeader) {
        headerRow.forEach((h, i) => {
          if (['word', 'text', '单词', '词'].includes(h)) colMap.word = i;
          else if (['phonetic', '音标'].includes(h)) colMap.phonetic = i;
          else if (['definition', 'meaning', '释义', '意思'].includes(h)) colMap.definition = i;
          else if (['example', 'examplesentence', '例句'].includes(h)) colMap.example = i;
          else if (['pos', 'partofspeech', '词性'].includes(h)) colMap.pos = i;
          else if (['difficulty', '难度'].includes(h)) colMap.difficulty = i;
          else if (['category', '分类'].includes(h)) colMap.category = i;
        });
      }
      words = dataRows.map((row) => ({
        word: (row[colMap.word] || '').trim(),
        phonetic: colMap.phonetic !== undefined ? (row[colMap.phonetic] || '').trim() : undefined,
        definition: (row[colMap.definition] || '').trim(),
        exampleSentence: colMap.example !== undefined ? (row[colMap.example] || '').trim() : undefined,
        partOfSpeech: colMap.pos !== undefined ? (row[colMap.pos] || '').trim() : undefined,
        difficulty: normalizeDifficulty(colMap.difficulty !== undefined ? row[colMap.difficulty] : undefined),
        category: colMap.category !== undefined ? (row[colMap.category] || '考研英语').trim() : '考研英语',
      })).filter(w => w.word && w.definition);
    }

    const unique = new Map<string, ParsedWord>();
    for (const w of words) {
      const key = w.word.toLowerCase();
      if (!unique.has(key)) unique.set(key, w);
    }
    const deduped = Array.from(unique.values());

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    const existing = await prisma.word.findMany({
      where: { word: { in: deduped.map(w => w.word) } },
      select: { word: true },
    });
    const existingSet = new Set(existing.map(w => w.word.toLowerCase()));

    for (const w of deduped) {
      if (skipExisting && existingSet.has(w.word.toLowerCase())) {
        skipped++;
        continue;
      }
      try {
        await prisma.word.create({
          data: {
            word: w.word,
            phonetic: w.phonetic || null,
            definition: w.definition,
            exampleSentence: w.exampleSentence || null,
            partOfSpeech: w.partOfSpeech || null,
            difficulty: w.difficulty || 'medium',
            category: w.category || '考研英语',
          },
        });
        imported++;
      } catch {
        failed++;
      }
    }

    res.json({ imported, skipped, failed, total: deduped.length });
  } catch (error) {
    console.error('导入失败', error);
    res.status(500).json({ error: '导入失败：' + (error as Error).message });
  }
});

wordImportRoutes.get('/stats', async (_req, res) => {
  try {
    const total = await prisma.word.count();
    const byCategory = await prisma.word.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    const byDifficulty = await prisma.word.groupBy({
      by: ['difficulty'],
      _count: { _all: true },
    });
    res.json({
      total,
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count._all })),
      byDifficulty: byDifficulty.map(d => ({ difficulty: d.difficulty, count: d._count._all })),
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计失败' });
  }
});
