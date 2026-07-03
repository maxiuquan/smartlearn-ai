"""
导入知识点数据到 PostgreSQL
用法: python scripts/import_knowledge.py
"""
import json
import os
import sys
import logging

import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "knowledge-points")
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


def flatten_knowledge_points(
    data: dict | list, subject: str, chapter_name: str = ""
) -> list[dict]:
    """递归展平知识点树结构"""
    points: list[dict] = []
    if isinstance(data, dict):
        chapter_name = data.get("name", data.get("chapter", chapter_name))
        children = data.get("children", data.get("sections", []))
        if not children and data.get("id"):
            points.append(
                {
                    "name": data.get("name", ""),
                    "subject": data.get("subject", subject),
                    "category": data.get("category", chapter_name),
                    "chapter": chapter_name,
                    "description": data.get("description", ""),
                    "difficulty": data.get("difficulty", 1),
                }
            )
        for child in children:
            points.extend(flatten_knowledge_points(child, subject, chapter_name))
    elif isinstance(data, list):
        for item in data:
            points.extend(flatten_knowledge_points(item, subject, chapter_name))
    return points


def main() -> None:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS knowledge_points (
            id SERIAL PRIMARY KEY,
            name VARCHAR(500) NOT NULL,
            subject VARCHAR(50) DEFAULT 'math',
            category VARCHAR(200),
            chapter VARCHAR(200),
            description TEXT,
            difficulty INTEGER DEFAULT 1,
            parent_id INTEGER REFERENCES knowledge_points(id),
            created_at TIMESTAMP DEFAULT NOW()
        );
    """
    )

    files = ["math.json", "linear-algebra.json", "probability.json"]
    total = 0

    for filename in files:
        data = load_json(filename)
        if not data:
            continue
        subject_map = {
            "math.json": "math",
            "linear-algebra.json": "linear-algebra",
            "probability.json": "probability",
        }
        subject = subject_map.get(filename, "math")
        points = flatten_knowledge_points(data, subject)

        if points:
            columns = ["name", "subject", "category", "chapter", "description", "difficulty"]
            values = [[p[c] for c in columns] for p in points]
            execute_values(
                cur,
                f"INSERT INTO knowledge_points ({', '.join(columns)}) VALUES %s ON CONFLICT DO NOTHING",
                values,
                template=f"(%s, %s, %s, %s, %s, %s)",
            )
            total += len(points)
            logger.info(f"[OK] {filename}: 导入 {len(points)} 个知识点")

    conn.commit()
    cur.close()
    conn.close()
    logger.info(f"\n[完成] 共导入 {total} 个知识点")


if __name__ == "__main__":
    main()