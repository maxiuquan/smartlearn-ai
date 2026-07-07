"""
导入词汇数据到 PostgreSQL（复用 ORM，不再自建表）

用法: python scripts/import_vocabulary.py
前置条件: 已执行 `alembic upgrade head` 创建表结构（表结构由迁移保证，本脚本只做数据写入）。

设计依据: 整改设计-2026-07-08 B1（P0-4/P0-5）
- 删除全部裸 CREATE TABLE / DROP TABLE（含原 word_books 孤儿表，无对应 ORM 模型）
- 通过 `app` 的 ORM 模型（VocabularyWord）经 SessionLocal 写入
- 字段严格对齐 ORM 列定义：word_id/headword/meaning/phonetic/tags/frequency/
  synonyms/antonyms/examples（examples 为 JSONB，原 example_sentence 文本并入 examples 列表）
- word_id 为主键，使用 ON CONFLICT DO UPDATE 实现幂等 upsert（可安全刷新）
- synonyms.json / word-frequency.json 按 headword 更新同反义词与词频
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

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.session import SessionLocal
from app.models import VocabularyWord

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "vocabulary")


def load_json(filename: str):
    """加载 JSON 数据文件；不存在时返回 None。"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        logger.warning("[SKIP] 文件不存在: %s", path)
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _to_orm_word(w: dict) -> dict:
    """将单词 JSON 映射为 ORM VocabularyWord 字段。"""
    word_id = w.get("id", w.get("word_id"))
    headword = w.get("word", w.get("headword", ""))

    tags = w.get("tags")
    if not tags and w.get("category"):
        tags = [w["category"]]

    example = w.get("example") or w.get("example_sentence")
    examples = w.get("examples")
    if not examples and example:
        examples = [example]

    return {
        "word_id": word_id,
        "headword": headword,
        "meaning": w.get("meaning", w.get("definition", "")),
        "phonetic": w.get("phonetic", ""),
        "tags": tags,
        "frequency": int(w.get("frequency", 0) or 0),
        "synonyms": w.get("synonyms") or None,
        "antonyms": w.get("antonyms") or None,
        "examples": examples,
    }


def import_words(db, kaoyan) -> int:
    """upsert kaoyan-words 中的单词（按 word_id 幂等）。返回写入条数。"""
    if not kaoyan:
        return 0
    words = kaoyan.get("words", [])
    rows = []
    for w in words:
        if not isinstance(w, dict):
            continue
        row = _to_orm_word(w)
        if not row["word_id"] or not row["headword"]:
            continue
        rows.append(row)
    if not rows:
        return 0

    stmt = pg_insert(VocabularyWord).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["word_id"],
        set_={
            "headword": stmt.excluded.headword,
            "meaning": stmt.excluded.meaning,
            "phonetic": stmt.excluded.phonetic,
            "tags": stmt.excluded.tags,
            "frequency": stmt.excluded.frequency,
            "synonyms": stmt.excluded.synonyms,
            "antonyms": stmt.excluded.antonyms,
            "examples": stmt.excluded.examples,
        },
    )
    db.execute(stmt)
    db.commit()
    logger.info("[OK] kaoyan-words.json: upsert %d 个单词", len(rows))
    return len(rows)


def update_synonyms(db, synonyms) -> None:
    """按 headword 更新同反义词。"""
    if not synonyms:
        return
    syn_list = synonyms.get("words", synonyms.get("synonyms", []))
    updated = 0
    for s in syn_list:
        if not isinstance(s, dict):
            continue
        word = s.get("word", "")
        if not word:
            continue
        obj = db.execute(
            select(VocabularyWord).where(VocabularyWord.headword == word)
        ).scalar_one_or_none()
        if obj is None:
            continue
        obj.synonyms = s.get("synonyms") or []
        obj.antonyms = s.get("antonyms") or []
        updated += 1
    db.commit()
    logger.info("[OK] synonyms.json: 更新 %d 个单词的同反义词", updated)


def update_frequency(db, frequency) -> None:
    """按 headword 更新词频。"""
    if not frequency:
        return
    freq_words = frequency.get("words", [])
    updated = 0
    for fw in freq_words:
        if not isinstance(fw, dict):
            continue
        word = fw.get("word", "")
        if not word:
            continue
        obj = db.execute(
            select(VocabularyWord).where(VocabularyWord.headword == word)
        ).scalar_one_or_none()
        if obj is None:
            continue
        obj.frequency = int(fw.get("frequency", obj.frequency) or 0)
        updated += 1
    db.commit()
    logger.info("[OK] word-frequency.json: 更新 %d 个单词词频", updated)


def main() -> None:
    total = 0
    with SessionLocal() as db:
        total += import_words(db, load_json("kaoyan-words.json"))
        update_synonyms(db, load_json("synonyms.json"))
        update_frequency(db, load_json("word-frequency.json"))
        # 说明: word-books.json 无对应 ORM 模型 / 迁移表，本轮不导入
        # （详见整改设计-2026-07-08 待明确事项 3：achievements/word_books 属孤儿表）。

    logger.info("\n[完成] 共 upsert/更新 %d 个单词", total)


if __name__ == "__main__":
    main()
