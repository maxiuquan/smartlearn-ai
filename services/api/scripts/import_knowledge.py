"""
导入知识点数据到 PostgreSQL（复用 ORM，不再自建表）

用法: python scripts/import_knowledge.py
前置条件: 已执行 `alembic upgrade head` 创建表结构（表结构由迁移保证，本脚本只做数据写入）。

设计依据: 整改设计-2026-07-08 B1（P0-4/P0-5）
- 删除全部裸 CREATE TABLE / DROP TABLE
- 通过 `app` 的 ORM 模型（KnowledgePoint）经 SessionLocal 写入
- 字段严格对齐 ORM 列定义（subject/chapter/section/name/description/
  difficulty/importance/keywords/prerequisites）
- 依赖 `alembic upgrade head` 保证表存在，本脚本不建表
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
from app.models import KnowledgePoint

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# data 目录: 兼容本地(services/api/scripts -> ../../../data)与容器(/app/scripts -> /app/data)
_DATA_CANDIDATES = [
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "knowledge-points"),  # 本地开发
    os.path.join(os.path.dirname(__file__), "..", "data", "knowledge-points"),  # 容器内 /app/scripts -> /app/data
    "/app/data/knowledge-points",  # 容器内绝对路径兜底
]
DATA_DIR = next((os.path.abspath(p) for p in _DATA_CANDIDATES if os.path.isdir(p)), _DATA_CANDIDATES[0])

# 文件名 -> 学科代码（覆盖 data/knowledge-points 下全部知识点文件）
SUBJECT_FILE_MAP = {
    "math.json": "math",
    "linear-algebra.json": "linear-algebra",
    "probability.json": "probability",
    "english.json": "english",
}


def load_json(filename: str) -> dict | list | None:
    """加载 JSON 数据文件；不存在时返回 None。"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        logger.warning("[SKIP] 文件不存在: %s", path)
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def flatten_knowledge_points(data, subject: str) -> list[dict]:
    """递归展平知识点树为 ORM 可写入的 dict 列表。

    兼容实际数据结构 chapters -> sections -> points，
    以及旧式 children / sections 容器；同时收集 chapter/section 名称。
    """
    points: list[dict] = []

    def walk(node, chapter: str, section: str) -> None:
        if isinstance(node, dict):
            node_name = node.get("name") or node.get("chapter")
            # 章节容器（嵌套 chapters）
            if isinstance(node.get("chapters"), list):
                for ch in node["chapters"]:
                    walk(ch, chapter, section)
                return
            # 章节 -> 小节（sections）
            if isinstance(node.get("sections"), list):
                ch = node_name or chapter
                for s in node["sections"]:
                    s_name = s.get("name") if isinstance(s, dict) else None
                    walk(s, ch, s_name or section)
                return
            # 旧式 children 容器
            if isinstance(node.get("children"), list):
                ch = node_name or chapter
                for c in node["children"]:
                    walk(c, ch, section)
                return
            # 小节 -> 知识点列表（points）
            if isinstance(node.get("points"), list):
                for p in node["points"]:
                    walk(p, chapter, section)
                return
            # 叶子：单个知识点
            if node.get("name"):
                points.append(
                    {
                        "subject": subject,
                        "chapter": chapter or node.get("chapter"),
                        "section": section or node.get("section"),
                        "name": node.get("name", ""),
                        "description": node.get("description", ""),
                        "difficulty": int(node.get("difficulty", 1) or 1),
                        "importance": int(node.get("importance", 1) or 1),
                        "keywords": node.get("keywords") or [],
                        "prerequisites": node.get("prerequisites") or [],
                    }
                )
        elif isinstance(node, list):
            for item in node:
                walk(item, chapter, section)

    walk(data, "", "")
    return points


def main() -> None:
    total = 0
    with SessionLocal() as db:
        for filename, subject in SUBJECT_FILE_MAP.items():
            data = load_json(filename)
            if not data:
                continue

            points = flatten_knowledge_points(data, subject)
            if not points:
                logger.warning("[SKIP] %s: 未解析到知识点", filename)
                continue

            # 幂等：该学科已存在则跳过（避免重复写入；如需刷新请手动清空 knowledge_points）
            existing = (
                db.execute(
                    select(func.count())
                    .select_from(KnowledgePoint)
                    .where(KnowledgePoint.subject == subject)
                ).scalar()
                or 0
            )
            if existing > 0:
                logger.info(
                    "[SKIP] %s: 学科 %s 已存在 %d 条，跳过（刷新请先清空 knowledge_points）",
                    filename,
                    subject,
                    existing,
                )
                continue

            db.bulk_insert_mappings(KnowledgePoint, points)
            db.commit()
            total += len(points)
            logger.info("[OK] %s: 导入 %d 个知识点（学科 %s）", filename, len(points), subject)

    logger.info("\n[完成] 共导入 %d 个知识点", total)


if __name__ == "__main__":
    main()
