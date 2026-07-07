# 词汇数据说明

**词汇规模**：CET4 核心词汇 ~3629 条 + 考研高频词汇 ~775 条 = **4404 条**（去重后），字段对齐 VocabularyWord ORM。

| 文件 | 条目数 | 说明 |
|---|---:|---|
| `cet4-core.json` | 3629 | CET4 核心词汇，含真实单词/音标/释义/例句/同义词/反义词 |
| `kaoyan-high-freq.json` | 775 | 考研高频词汇（与 CET4 去重），含真实单词/音标/释义/例句 |
| `kaoyan-words.json` | 220 | 考研核心词汇（第一轮已有） |
| `synonyms.json` | 100 | 同义词 |
| `word-books.json` | 8 | 单词书配置 |
| `word-frequency.json` | 200 | 词频数据 |
| **合计** | **4404+** | 持续扩充中 |

> 字段对齐 `VocabularyWord` ORM：`word_id` / `headword` / `meaning` / `phonetic` / `tags` / `frequency` / `synonyms` / `antonyms` / `examples`
>
> `word_id` 前缀区分来源：`cet4-XXXX`（CET4 核心）、`ky-XXXX`（考研高频）、`wXXX`（原有 kaoyan-words）
>
> `frequency` 1-5 整数：5=最高频，1=低频。游戏 difficulty 映射：easy→freq≥4，medium→freq 2-3，hard→freq 1
>
> `examples` 为对象数组：`[{"en": "英文例句", "zh": "中文翻译"}]`
>
> 生成脚本：`python scripts/generate_vocabulary.py`
