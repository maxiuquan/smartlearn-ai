"""
导入题目数据到 PostgreSQL（复用 ORM，不再自建表）

用法: python scripts/import_questions.py
前置条件: 已执行 `alembic upgrade head` 创建表结构（表结构由迁移保证，本脚本只做数据写入）。

设计依据: 整改设计-2026-07-08 B1（P0-4/P0-5）
- 删除全部裸 CREATE TABLE / DROP TABLE（含原 question_knowledge_points 关联表）
- 通过 `app` 的 ORM 模型（Question）经 SessionLocal 写入
- 字段严格对齐 ORM 列定义：subject/type/difficulty/title/content/options/
  answer/solution/knowledge_points（均为 ORM 现有列；external_id/chapter/
  section/source/tags 不在 ORM 中，故不写入）
- options / knowledge_points 为 JSONB，保留原始 list/dict 结构（不再 json.dumps 成文本）
- 依赖 `alembic upgrade head` 保证表存在
"""
import json
import os
import sys
import logging

# 将 services/api 加入 sys.path，以便 `import app`
API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if API_ROOT not in sys.path:
    sys.path.insert(0, API_ROOT)

from sqlalchemy import func, select

from app.db.session import SessionLocal
from app.models import Question

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "questions")


def load_json(filename: str) -> dict | list | None:
    """加载 JSON 数据文件；不存在时返回 None。"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        logger.warning("[SKIP] 文件不存在: %s", path)
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _to_orm_question(q: dict, subject: str) -> dict:
    """将单题 JSON 映射为 ORM Question 字段（仅保留 ORM 定义的列）。"""
    options = q.get("options")
    if options is not None and not isinstance(options, (list, dict)):
        options = None

    kps = q.get("knowledge_points")
    if kps is not None and not isinstance(kps, list):
        kps = [kps] if kps else None

    return {
        "subject": subject,
        "type": q.get("type", "choice"),
        "difficulty": int(q.get("difficulty", 1) or 1),
        "title": q.get("title"),
        "content": q.get("content", ""),
        "options": options,  # JSONB，保持 list/dict 原样
        "answer": q.get("answer", ""),
        "solution": q.get("solution"),
        "knowledge_points": kps,  # JSONB list
    }


def main() -> None:
    files = ["math-examples.json", "math-full.json", "english-full.json"]
    total = 0

    with SessionLocal() as db:
        for filename in files:
            data = load_json(filename)
            if not data:
                continue

            subject = data.get("subject_code", data.get("subject", "math"))
            if isinstance(subject, str):
                subject = subject.strip().lower()

            questions = data.get("questions")
            if not questions:
                questions = [data] if isinstance(data, dict) else data
            if not isinstance(questions, list):
                continue

            orm_rows = []
            for q in questions:
                if not isinstance(q, dict):
                    continue
                orm_rows.append(_to_orm_question(q, subject))

            if not orm_rows:
                logger.warning("[SKIP] %s: 未解析到题目", filename)
                continue

            # 幂等：该学科已存在则跳过。
            # 注意：questions 被 user_question_attempts / wrong_questions 外键引用，
            # 不宜清空，故采用"跳过已存在学科"策略以避免重复与误删用户数据。
            existing = (
                db.execute(
                    select(func.count())
                    .select_from(Question)
                    .where(Question.subject == subject)
                ).scalar()
                or 0
            )
            if existing > 0:
                logger.info(
                    "[SKIP] %s: 学科 %s 已存在 %d 题，跳过（刷新请先清空 questions）",
                    filename,
                    subject,
                    existing,
                )
                continue

            db.bulk_insert_mappings(Question, orm_rows)
            db.commit()
            total += len(orm_rows)
            logger.info("[OK] %s: 导入 %d 道题目（学科 %s）", filename, len(orm_rows), subject)

    logger.info("\n[完成] 共导入 %d 道题目", total)


if __name__ == "__main__":
    main()
