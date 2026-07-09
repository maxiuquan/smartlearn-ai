"""SmartLearn AI 全面端到端测试

覆盖所有 API 端点：
  - 认证 (auth)
  - 统计 (statistics)
  - 系统 (system)
  - 用户管理 (users)
  - 审计日志 (audit-logs)
  - 题目 (questions)
  - 词汇 (vocab)
  - 知识点 (knowledge)
  - 学科管理 (subjects)
  - 真题管理 (past-exams)
  - 习题册 (workbooks)
  - 游戏 (games)
  - 错题 (wrong-questions)
  - 健康检查 (health, keepalive)
"""
import json
import sys
import time

import requests

BASE = "https://maxiuquan-xuexi.hf.space"
ADMIN_USER = "maxiuquan@163.com"
ADMIN_PASS = "Admin@12345678"

results = []


def log(category, path, method, status_code, detail=""):
    icon = "OK " if 200 <= status_code < 300 else "ERR"
    short = path.replace("/api/v1", "")
    msg = f"  [{category}] {icon} {status_code} {method} {short}"
    if detail:
        msg += f"  {detail}"
    print(msg)
    results.append((category, path, method, status_code, 200 <= status_code < 300))


def login():
    """登录获取 token"""
    r = requests.post(
        f"{BASE}/api/v1/auth/login",
        json={"username": ADMIN_USER, "password": ADMIN_PASS},
        timeout=30,
    )
    if r.status_code != 200:
        print(f"LOGIN FAILED: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    token = r.json().get("access_token")
    if not token:
        print(f"NO TOKEN: {r.text[:200]}")
        sys.exit(1)
    print(f"Login OK, token={token[:20]}...")
    return token


def test_health():
    """健康检查（无需认证）"""
    print("\n=== 健康检查 ===")
    for p in ["/health", "/keepalive"]:
        try:
            r = requests.get(f"{BASE}{p}", timeout=15)
            log("health", p, "GET", r.status_code, r.text[:50])
        except Exception as e:
            log("health", p, "GET", 0, str(e)[:50])


def test_auth(h):
    print("\n=== 认证 ===")
    r = requests.get(f"{BASE}/api/v1/auth/me", headers=h, timeout=15)
    log("auth", "/auth/me", "GET", r.status_code)
    if r.status_code == 200:
        user = r.json()
        print(f"    user: {user.get('username', 'N/A')} role={user.get('role', 'N/A')}")


def test_statistics(h):
    print("\n=== 统计 ===")
    for p in [
        "/api/v1/statistics/overview",
        "/api/v1/statistics/users?page=1&page_size=10",
    ]:
        r = requests.get(f"{BASE}{p}", headers=h, timeout=15)
        detail = ""
        if r.status_code == 200:
            d = r.json()
            if "total_users" in d:
                detail = f"users={d.get('total_users')}"
            elif "total" in d:
                detail = f"total={d.get('total')}"
        log("statistics", p, "GET", r.status_code, detail)


def test_system(h):
    print("\n=== 系统 ===")
    for p in [
        "/api/v1/system/config",
        "/api/v1/system/features",
        "/api/v1/system/info",
        "/api/v1/system/logs",
    ]:
        r = requests.get(f"{BASE}{p}", headers=h, timeout=15)
        log("system", p, "GET", r.status_code)


def test_users(h):
    print("\n=== 用户管理 ===")
    r = requests.get(f"{BASE}/api/v1/users?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("users", "/users", "GET", r.status_code, detail)


def test_audit(h):
    print("\n=== 审计日志 ===")
    r = requests.get(f"{BASE}/api/v1/audit-logs?page=1&page_size=10", headers=h, timeout=15)
    log("audit", "/audit-logs", "GET", r.status_code)


def test_questions(h):
    print("\n=== 题目 ===")
    # 列表
    r = requests.get(f"{BASE}/api/v1/questions?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    question_id = None
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
        items = d.get("items", [])
        if items:
            question_id = items[0].get("id")
    log("questions", "/questions", "GET", r.status_code, detail)

    # 推荐
    r2 = requests.get(f"{BASE}/api/v1/questions/recommend?count=5", headers=h, timeout=15)
    detail2 = ""
    if r2.status_code == 200:
        d = r2.json()
        detail2 = f"count={len(d.get('questions', []))}"
    log("questions", "/questions/recommend", "GET", r2.status_code, detail2)

    # 详情
    if question_id:
        r3 = requests.get(f"{BASE}/api/v1/questions/{question_id}", headers=h, timeout=15)
        log("questions", f"/questions/{question_id}", "GET", r3.status_code)

        # 尝试提交答案
        try:
            r4 = requests.post(
                f"{BASE}/api/v1/questions/{question_id}/attempt",
                json={"user_answer": "A", "duration_ms": 5000},
                headers=h,
                timeout=15,
            )
            log("questions", f"/questions/{question_id}/attempt", "POST", r4.status_code)
        except Exception as e:
            log("questions", f"/questions/{question_id}/attempt", "POST", 0, str(e)[:50])


def test_vocab(h):
    print("\n=== 词汇 ===")
    # 单词列表
    r = requests.get(f"{BASE}/api/v1/vocab/words?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("vocab", "/vocab/words", "GET", r.status_code, detail)

    # 进度
    r2 = requests.get(f"{BASE}/api/v1/vocab/progress", headers=h, timeout=15)
    log("vocab", "/vocab/progress", "GET", r2.status_code)

    # 今日待复习
    r3 = requests.get(f"{BASE}/api/v1/vocab/due", headers=h, timeout=15)
    log("vocab", "/vocab/due", "GET", r3.status_code)


def test_knowledge(h):
    print("\n=== 知识点 ===")
    # 搜索
    r = requests.get(f"{BASE}/api/v1/knowledge/search?q=函数&page=1&page_size=10", headers=h, timeout=15)
    log("knowledge", "/knowledge/search", "GET", r.status_code)

    # 学科树 (只有 math/english 有数据文件)
    for subj in ["math", "english"]:
        r2 = requests.get(f"{BASE}/api/v1/knowledge/{subj}", headers=h, timeout=15)
        log("knowledge", f"/knowledge/{subj}", "GET", r2.status_code)


def test_admin_data(h):
    print("\n=== 学科管理 ===")
    r = requests.get(f"{BASE}/api/v1/subjects?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("subjects", "/subjects", "GET", r.status_code, detail)

    r2 = requests.get(f"{BASE}/api/v1/subjects/all", headers=h, timeout=15)
    log("subjects", "/subjects/all", "GET", r2.status_code)

    r3 = requests.get(f"{BASE}/api/v1/subjects/math/stats", headers=h, timeout=15)
    log("subjects", "/subjects/math/stats", "GET", r3.status_code)

    print("\n=== 词书管理 ===")
    r = requests.get(f"{BASE}/api/v1/vocab/word-books?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("word-books", "/vocab/word-books", "GET", r.status_code, detail)

    print("\n=== 真题管理 ===")
    r = requests.get(f"{BASE}/api/v1/past-exams?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("past-exams", "/past-exams", "GET", r.status_code, detail)

    r2 = requests.get(f"{BASE}/api/v1/past-exams/stats", headers=h, timeout=15)
    log("past-exams", "/past-exams/stats", "GET", r2.status_code)

    print("\n=== 习题册管理 ===")
    r = requests.get(f"{BASE}/api/v1/workbooks?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("workbooks", "/workbooks", "GET", r.status_code, detail)


def test_games(h):
    print("\n=== 游戏 ===")
    # 游戏列表
    r = requests.get(f"{BASE}/api/v1/games", headers=h, timeout=15)
    detail = ""
    game_ids = []
    if r.status_code == 200:
        d = r.json()
        games = d.get("games", [])
        detail = f"count={len(games)}"
        game_ids = [g.get("game_id") for g in games[:3]]  # 测试前 3 个
    log("games", "/games", "GET", r.status_code, detail)

    # 游戏详情
    for gid in game_ids:
        if gid:
            r2 = requests.get(f"{BASE}/api/v1/games/{gid}", headers=h, timeout=15)
            log("games", f"/games/{gid}", "GET", r2.status_code)

    # 提交游戏会话
    if game_ids and game_ids[0]:
        try:
            r3 = requests.post(
                f"{BASE}/api/v1/games/{game_ids[0]}/sessions",
                json={
                    "game_id": game_ids[0],
                    "score": 80,
                    "accuracy": 0.8,
                    "duration": 60,
                    "started_at": "2026-07-09T10:00:00Z",
                    "finished_at": "2026-07-09T10:01:00Z",
                },
                headers=h,
                timeout=15,
            )
            log("games", f"/games/{game_ids[0]}/sessions", "POST", r3.status_code)
        except Exception as e:
            log("games", f"/games/{game_ids[0]}/sessions", "POST", 0, str(e)[:50])

    # 排行榜
    r4 = requests.get(f"{BASE}/api/v1/games/leaderboards/global", headers=h, timeout=15)
    log("games", "/games/leaderboards/global", "GET", r4.status_code)


def test_wrong_questions(h):
    print("\n=== 错题本 ===")
    r = requests.get(f"{BASE}/api/v1/wrong-questions", headers=h, timeout=15)
    log("wrong-questions", "/wrong-questions", "GET", r.status_code)


def main():
    print("=" * 60)
    print("SmartLearn AI 全面端到端测试")
    print(f"URL: {BASE}")
    print("=" * 60)

    token = login()
    h = {"Authorization": f"Bearer {token}"}

    test_health()
    test_auth(h)
    test_statistics(h)
    test_system(h)
    test_users(h)
    test_audit(h)
    test_questions(h)
    test_vocab(h)
    test_knowledge(h)
    test_admin_data(h)
    test_games(h)
    test_wrong_questions(h)

    # 汇总
    print("\n" + "=" * 60)
    print("测试汇总")
    print("=" * 60)
    by_cat = {}
    for cat, path, method, code, ok in results:
        if cat not in by_cat:
            by_cat[cat] = {"ok": 0, "fail": 0}
        if ok:
            by_cat[cat]["ok"] += 1
        else:
            by_cat[cat]["fail"] += 1

    total_ok = total_fail = 0
    for cat, counts in sorted(by_cat.items()):
        ok = counts["ok"]
        fail = counts["fail"]
        total_ok += ok
        total_fail += fail
        status = "PASS" if fail == 0 else "FAIL"
        print(f"  [{status}] {cat:20s} OK={ok} FAIL={fail}")

    print(f"\n  总计: OK={total_ok} FAIL={total_fail}")
    if total_fail == 0:
        print("\n  *** 全部测试通过 ***")
    else:
        print(f"\n  *** {total_fail} 个测试失败 ***")

    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
