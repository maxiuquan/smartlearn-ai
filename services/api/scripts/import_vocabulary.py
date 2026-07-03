"""
导入词汇数据到 PostgreSQL
用法: python scripts/import_vocabulary.py
"""
import json
import os
import sys
import logging

import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "vocabulary")
DB_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql://{os.environ.get('POSTGRES_USER', 'postgres')}:{os.environ.get('POSTGRES_PASSWORD', 'postgres')}@{os.environ.get('POSTGRES_SERVER', 'localhost')}:{os.environ.get('POSTGRES_PORT', '5432')}/{os.environ.get('POSTGRES_DB', 'smartlearn')}",
)


def load_json(filename: str) -> dict | list | None:
    """加载 JSON 数据文件"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        logger.warning(f"[SKIP] 文件不存在: {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute(
        """
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
    """
    )

    total = 0

    kaoyan = load_json("kaoyan-words.json")
    if kaoyan:
        words = kaoyan.get("words", [])
        for w in words:
            if not isinstance(w, dict):
                continue
            word_id = w.get("id", w.get("word_id", ""))
            headword = w.get("word", w.get("headword", ""))
            synonyms = w.get("synonyms", [])
            antonyms = w.get("antonyms", [])
            tags = w.get("tags", [])

            cur.execute(
                """
                INSERT INTO vocabulary_words (word_id, headword, phonetic, meaning, example_sentence, part_of_speech, difficulty, category, frequency, tags, synonyms, antonyms)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (word_id) DO UPDATE SET
                    meaning = EXCLUDED.meaning,
                    example_sentence = EXCLUDED.example_sentence
            """,
                (
                    word_id,
                    headword,
                    w.get("phonetic", ""),
                    w.get("meaning", w.get("definition", "")),
                    w.get("example", w.get("example_sentence", "")),
                    w.get("part_of_speech", ""),
                    w.get("difficulty", "medium"),
                    w.get("category", "考研英语"),
                    w.get("frequency", 0),
                    ",".join(tags) if isinstance(tags, list) else str(tags),
                    ",".join(synonyms) if isinstance(synonyms, list) else "",
                    ",".join(antonyms) if isinstance(antonyms, list) else "",
                ),
            )
            total += 1
        logger.info(f"[OK] kaoyan-words.json: 导入 {len(words)} 个单词")

    synonyms = load_json("synonyms.json")
    if synonyms:
        syn_list = synonyms.get("words", synonyms.get("synonyms", []))
        for s in syn_list:
            if isinstance(s, dict):
                word = s.get("word", "")
                syns = s.get("synonyms", [])
                ants = s.get("antonyms", [])
                if word:
                    cur.execute(
                        """
                        UPDATE vocabulary_words
                        SET synonyms = CASE WHEN synonyms IS NULL OR synonyms = '' THEN %s ELSE synonyms || ',' || %s END,
                            antonyms = CASE WHEN antonyms IS NULL OR antonyms = '' THEN %s ELSE antonyms || ',' || %s END
                        WHERE headword = %s
                    """,
                        (
                            ",".join(syns) if isinstance(syns, list) else "",
                            ",".join(syns) if isinstance(syns, list) else "",
                            ",".join(ants) if isinstance(ants, list) else "",
                            ",".join(ants) if isinstance(ants, list) else "",
                            word,
                        ),
                    )
        logger.info(f"[OK] synonyms.json: 更新同反义词")

    frequency = load_json("word-frequency.json")
    if frequency:
        freq_words = frequency.get("words", [])
        for fw in freq_words:
            if isinstance(fw, dict):
                cur.execute(
                    """
                    UPDATE vocabulary_words SET frequency = %s WHERE headword = %s
                """,
                    (fw.get("frequency", 0), fw.get("word", "")),
                )
        logger.info(f"[OK] word-frequency.json: 更新 {len(freq_words)} 个词频")

    conn.commit()
    cur.close()
    conn.close()
    logger.info(f"\n[完成] 共导入/更新 {total} 个单词")


if __name__ == "__main__":
    main()