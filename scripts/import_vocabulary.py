"""
导入词汇数据到 PostgreSQL
用法: python scripts/import_vocabulary.py
"""
import json
import os
import sys
import psycopg2
from psycopg2.extras import execute_values

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'vocabulary')
DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/smartlearn')

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print(f"[SKIP] 文件不存在: {path}")
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 创建表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vocabulary_words (
            id SERIAL PRIMARY KEY,
            word_id VARCHAR(100) UNIQUE,
            headword VARCHAR(200) NOT NULL,
            phonetic VARCHAR(200),
            meaning TEXT NOT NULL,
            example_sentence TEXT,
            part_of_speech VARCHAR(50),
            difficulty VARCHAR(50) DEFAULT 'medium',
            category VARCHAR(100) DEFAULT '考研英语',
            frequency INTEGER DEFAULT 0,
            tags TEXT,
            synonyms TEXT,
            antonyms TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS word_books (
            id SERIAL PRIMARY KEY,
            book_id VARCHAR(100) UNIQUE,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            total_words INTEGER DEFAULT 0,
            category VARCHAR(100),
            difficulty VARCHAR(50),
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    total = 0

    # 导入考研核心词汇
    kaoyan = load_json('kaoyan-words.json')
    if kaoyan:
        words = kaoyan.get('words', [])
        for w in words:
            if not isinstance(w, dict):
                continue
            word_id = w.get('id', w.get('word_id', ''))
            headword = w.get('word', w.get('headword', ''))
            synonyms = w.get('synonyms', [])
            antonyms = w.get('antonyms', [])
            tags = w.get('tags', [])

            cur.execute("""
                INSERT INTO vocabulary_words (word_id, headword, phonetic, meaning, example_sentence, part_of_speech, difficulty, category, frequency, tags, synonyms, antonyms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (word_id) DO UPDATE SET
                    meaning = EXCLUDED.meaning,
                    example_sentence = EXCLUDED.example_sentence
            """, (
                word_id,
                headword,
                w.get('phonetic', ''),
                w.get('meaning', w.get('definition', '')),
                w.get('example', w.get('example_sentence', '')),
                w.get('part_of_speech', ''),
                w.get('difficulty', 'medium'),
                w.get('category', '考研英语'),
                w.get('frequency', 0),
                ','.join(tags) if isinstance(tags, list) else str(tags),
                ','.join(synonyms) if isinstance(synonyms, list) else '',
                ','.join(antonyms) if isinstance(antonyms, list) else '',
            ))
            total += 1
        print(f"[OK] kaoyan-words.json: 导入 {len(words)} 个单词")

    # 导入同反义词
    synonyms = load_json('synonyms.json')
    if synonyms:
        syn_list = synonyms.get('words', synonyms.get('synonyms', []))
        # 更新已有单词的同反义词
        for s in syn_list:
            if isinstance(s, dict):
                word = s.get('word', '')
                syns = s.get('synonyms', [])
                ants = s.get('antonyms', [])
                if word:
                    cur.execute("""
                        UPDATE vocabulary_words
                        SET synonyms = CASE WHEN synonyms IS NULL OR synonyms = '' THEN %s ELSE synonyms || ',' || %s END,
                            antonyms = CASE WHEN antonyms IS NULL OR antonyms = '' THEN %s ELSE antonyms || ',' || %s END
                        WHERE headword = %s
                    """, (
                        ','.join(syns) if isinstance(syns, list) else '',
                        ','.join(syns) if isinstance(syns, list) else '',
                        ','.join(ants) if isinstance(ants, list) else '',
                        ','.join(ants) if isinstance(ants, list) else '',
                        word,
                    ))
        print(f"[OK] synonyms.json: 更新同反义词")

    # 导入词频
    frequency = load_json('word-frequency.json')
    if frequency:
        freq_words = frequency.get('words', [])
        for fw in freq_words:
            if isinstance(fw, dict):
                cur.execute("""
                    UPDATE vocabulary_words SET frequency = %s WHERE headword = %s
                """, (fw.get('frequency', 0), fw.get('word', '')))
        print(f"[OK] word-frequency.json: 更新 {len(freq_words)} 个词频")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\n[完成] 共导入/更新 {total} 个单词")

if __name__ == '__main__':
    main()