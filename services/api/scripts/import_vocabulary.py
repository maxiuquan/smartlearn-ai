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
- 加载 3 个词汇源：cet4-core.json(顶层数组) / kaoyan-high-freq.json(顶层数组) /
  kaoyan-words.json({"words":[...]} 包裹)。三源 word_id 前缀不同(cet4-/ky-/w)，不冲突，
  重复 headword 作为独立行保留。
- synonyms.json / word-frequency.json 按 headword 更新同反义词与词频；
  因 headword 可能重复，按 headword 匹配时更新全部命中行。
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


def _extract_words(data) -> list:
    """从解析后的 JSON 中提取单词列表，兼容两种结构。

    - 顶层数组：cet4-core.json / kaoyan-high-freq.json → [{...}, ...]
    - 包裹对象：kaoyan-words.json → {"words": [{...}, ...]}
    """
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("words", [])
    return []


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


def import_words(db, words: list, source: str = "") -> int:
    """upsert 单词列表（按 word_id 幂等）。返回写入条数。"""
    if not words:
        return 0
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
    logger.info("[OK] %s: upsert %d 个单词", source or "vocabulary", len(rows))
    return len(rows)


def update_synonyms(db, synonyms) -> None:
    """按 headword 更新同反义词；重复 headword 更新全部命中行。"""
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
        objs = db.execute(
            select(VocabularyWord).where(VocabularyWord.headword == word)
        ).scalars().all()
        if not objs:
            continue
        for obj in objs:
            obj.synonyms = s.get("synonyms") or []
            obj.antonyms = s.get("antonyms") or []
        updated += len(objs)
    db.commit()
    logger.info("[OK] synonyms.json: 更新 %d 个单词的同反义词", updated)


def update_frequency(db, frequency) -> None:
    """按 headword 更新词频；重复 headword 更新全部命中行。"""
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
        objs = db.execute(
            select(VocabularyWord).where(VocabularyWord.headword == word)
        ).scalars().all()
        if not objs:
            continue
        new_freq = int(fw.get("frequency", 0) or 0)
        for obj in objs:
            obj.frequency = new_freq
        updated += len(objs)
    db.commit()
    logger.info("[OK] word-frequency.json: 更新 %d 个单词词频", updated)


def main() -> None:
    total = 0
    with SessionLocal() as db:
        # 三个词汇源均按 word_id 幂等 upsert；word_id 前缀不同(cet4-/ky-/w)，不冲突
        for filename in ("cet4-core.json", "kaoyan-high-freq.json", "kaoyan-words.json"):
            words = _extract_words(load_json(filename))
            total += import_words(db, words, filename)
        update_synonyms(db, load_json("synonyms.json"))
        update_frequency(db, load_json("word-frequency.json"))
        # 说明: word-books.json 无对应 ORM 模型 / 迁移表，本轮不导入
        # （详见整改设计-2026-07-08 待明确事项 3：achievements/word_books 属孤儿表）。

    logger.info("\n[完成] 共 upsert/更新 %d 个单词", total)


if __name__ == "__main__":
    main()
