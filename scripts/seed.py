"""
填充初始数据（成就、学习计划模板等）
用法: python scripts/seed.py
"""
import json
import os
import psycopg2

DB_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/smartlearn')

DEFAULT_ACHIEVEMENTS = [
    {"key": "first-login", "name": "初次登录", "description": "首次登录平台", "icon": "login", "category": "milestone", "threshold": 1},
    {"key": "streak-3", "name": "连续学习3天", "description": "连续打卡3天", "icon": "fire", "category": "streak", "threshold": 3},
    {"key": "streak-7", "name": "坚持不懈", "description": "连续打卡7天", "icon": "fire", "category": "streak", "threshold": 7},
    {"key": "streak-30", "name": "月度之星", "description": "连续打卡30天", "icon": "star", "category": "streak", "threshold": 30},
    {"key": "questions-10", "name": "初出茅庐", "description": "完成10道题目", "icon": "book", "category": "practice", "threshold": 10},
    {"key": "questions-100", "name": "百题斩", "description": "完成100道题目", "icon": "sword", "category": "practice", "threshold": 100},
    {"key": "questions-1000", "name": "题海无涯", "description": "完成1000道题目", "icon": "ocean", "category": "practice", "threshold": 1000},
    {"key": "words-50", "name": "词汇入门", "description": "掌握50个单词", "icon": "word", "category": "vocabulary", "threshold": 50},
    {"key": "words-500", "name": "词汇达人", "description": "掌握500个单词", "icon": "dictionary", "category": "vocabulary", "threshold": 500},
    {"key": "accuracy-80", "name": "精准射手", "description": "正确率达到80%以上", "icon": "target", "category": "skill", "threshold": 80},
    {"key": "accuracy-90", "name": "学霸降临", "description": "正确率达到90%以上", "icon": "crown", "category": "skill", "threshold": 90},
    {"key": "math-chapter-1", "name": "极限挑战", "description": "完成函数极限章节", "icon": "function", "category": "chapter", "threshold": 1},
    {"key": "math-chapter-2", "name": "微分大师", "description": "完成微分学章节", "icon": "derivative", "category": "chapter", "threshold": 1},
    {"key": "math-chapter-3", "name": "积分达人", "description": "完成积分学章节", "icon": "integral", "category": "chapter", "threshold": 1},
    {"key": "all-math", "name": "数学全通", "description": "完成所有数学章节", "icon": "trophy", "category": "milestone", "threshold": 1},
]

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 创建成就表
    cur.execute("""
        CREATE TABLE IF NOT EXISTS achievements (
            id SERIAL PRIMARY KEY,
            key VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            icon VARCHAR(100),
            category VARCHAR(100),
            threshold INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    # 插入默认成就
    count = 0
    for ach in DEFAULT_ACHIEVEMENTS:
        cur.execute("""
            INSERT INTO achievements (key, name, description, icon, category, threshold)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
        """, (ach['key'], ach['name'], ach['description'], ach['icon'], ach['category'], ach['threshold']))
        count += 1

    print(f"[OK] 插入 {count} 个成就")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\n[完成] 初始数据填充完成")

if __name__ == '__main__':
    main()