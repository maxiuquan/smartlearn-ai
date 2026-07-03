"""
导入所有数据（知识点 + 题目 + 词汇 + 初始数据）
用法: python scripts/import_all.py
"""
import subprocess
import sys
import os

def run_script(script_name):
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    print(f"\n{'='*60}")
    print(f"[运行] {script_name}")
    print(f"{'='*60}")
    result = subprocess.run([sys.executable, script_path], capture_output=False)
    if result.returncode != 0:
        print(f"[错误] {script_name} 执行失败 (exit code: {result.returncode})")
        return False
    return True

def main():
    scripts = [
        'import_knowledge.py',
        'import_questions.py',
        'import_vocabulary.py',
        'seed.py',
    ]

    success = 0
    failed = 0

    for script in scripts:
        if run_script(script):
            success += 1
        else:
            failed += 1

    print(f"\n{'='*60}")
    print(f"[完成] 成功: {success}, 失败: {failed}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()