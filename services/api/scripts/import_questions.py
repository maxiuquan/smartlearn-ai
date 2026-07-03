"""
导入题目数据到 PostgreSQL
用法: python scripts/import_questions.py
"""
import json
import os
import sys
import logging

import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "questions")
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
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            external_id VARCHAR(100) UNIQUE,
            question_type VARCHAR(50) DEFAULT 'choice',
            content TEXT NOT NULL,
            options TEXT,
            answer TEXT NOT NULL,
            solution TEXT,
            difficulty INTEGER DEFAULT 1,
            chapter VARCHAR(200),
            section VARCHAR(200),
            source VARCHAR(200),
            subject VARCHAR(50) DEFAULT 'math',
            tags TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS question_knowledge_points (
            id SERIAL PRIMARY KEY,
            question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
            knowledge_point_id INTEGER REFERENCES knowledge_points(id) ON DELETE CASCADE,
            UNIQUE(question_id, knowledge_point_id)
        );
    """
    )

    files = ["math-examples.json", "math-full.json", "english-full.json"]
    total = 0

    for filename in files:
        data = load_json(filename)
        if not data:
            continue

        subject = data.get("subject_code", data.get("subject", "math"))
        questions = data.get("questions", [])
        if not questions:
            questions = [data] if isinstance(data, dict) else data

        for q in questions:
            if not isinstance(q, dict):
                continue
            external_id = q.get("id", "")
            options = q.get("options")
            if isinstance(options, (list, dict)):
                options = json.dumps(options, ensure_ascii=False)
            tags = q.get("tags", [])
            if isinstance(tags, list):
                tags = ",".join(tags)

            cur.execute(
                """
                INSERT INTO questions (external_id, question_type, content, options, answer, solution, difficulty, chapter, section, source, subject, tags)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (external_id) DO UPDATE SET
                    content = EXCLUDED.content,
                    answer = EXCLUDED.answer,
                    solution = EXCLUDED.solution,
                    difficulty = EXCLUDED.difficulty
                RETURNING id
            """,
                (
                    external_id,
                    q.get("type", "choice"),
                    q.get("content", ""),
                    options,
                    q.get("answer", ""),
                    q.get("solution", ""),
                    q.get("difficulty", 1),
                    q.get("chapter", ""),
                    q.get("section", ""),
                    q.get("source", ""),
                    subject,
                    tags,
                ),
            )
            total += 1

        logger.info(f"[OK] {filename}: 导入 {len(questions)} 道题目")

    conn.commit()
    cur.close()
    conn.close()
    logger.info(f"\n[完成] 共导入 {total} 道题目")


if __name__ == "__main__":
    main()