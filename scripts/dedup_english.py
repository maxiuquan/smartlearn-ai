"""去重 english-full.json 并修复分类字段"""
import json
import os
from collections import Counter

src = r'f:\xiangmu\xuexi\data\questions\english-full.json'
with open(src, 'r', encoding='utf-8') as f:
    data = json.load(f)

questions = data.get('questions', [])
print(f"原始题数: {len(questions)}")

# 1. 按 content 去重
contents = [q.get('content', '') for q in questions]
counter = Counter(contents)
dups = {c: n for c, n in counter.items() if n > 1}
print(f"重复 content 数: {len(dups)}")
if dups:
    print("前10个重复:")
    for c, n in sorted(dups.items(), key=lambda x: -x[1])[:10]:
        print(f"  ({n}次) {c[:80]}")

# 去重：保留首次出现
seen = set()
unique = []
for q in questions:
    c = q.get('content', '')
    if c in seen:
        continue
    seen.add(c)
    unique.append(q)

print(f"去重后题数: {len(unique)}")

# 2. 统计分类字段
cats = Counter(q.get('category', '') for q in unique)
tags0 = Counter(q.get('tags', [''])[0] for q in unique)
kps = Counter(q.get('knowledge_points', [''])[0] for q in unique)
print(f"\ncategory 分布: {dict(cats)}")
print(f"tags[0] 分布: {dict(tags0)}")
print(f"knowledge_points[0] 分布: {dict(kps)}")

# 3. 写回
data['questions'] = unique
data['total_questions'] = len(unique)
data['last_updated'] = '2026-07-10'

with open(src, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"\n已写回 {len(unique)} 题")
