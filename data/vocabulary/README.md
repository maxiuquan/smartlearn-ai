# 词汇数据说明

**目标词库规模**：CET4 / 4541+。

**当前已录入约 528 条**（真实统计值，由脚本统计本目录各 JSON 数组长度得出）：

| 文件 | 条目数 | 说明 |
|---|---:|---|
| `kaoyan-words.json` | 220 | 考研核心词汇 |
| `synonyms.json` | 100 | 同义词 |
| `word-books.json` | 8 | 单词书配置 |
| `word-frequency.json` | 200 | 词频数据 |
| **合计** | **528** | 持续扩充中 |

> 说明：真实大规模词汇（目标 4541+）由版权方 / 后续录入流程补充，本目录当前为代表性子集，**不编造数据**。
> 统计脚本示例：`python -c "import json,glob; print(sum(len(json.load(open(f,encoding='utf-8')) if isinstance(json.load(open(f,encoding='utf-8')),list) else [v for v in json.load(open(f,encoding='utf-8')).values() if isinstance(v,list)][0] for f in glob.glob('data/vocabulary/*.json')))"`
