"""SmartLearn AI 全面端到端测试（R8 三段式游戏 API 重写版）

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
  - 游戏 (games) — 全部 25 款 + 异常场景 + 410 旧端点验证
  - 错题 (wrong-questions)
  - 健康检查 (health, keepalive)

R8 修改重点：
  - P0-01: 全部 25 款游戏改用三段式 API（start → answers → finish → summary）
  - P0-02: 验证响应中 correct_answer 已剥离
  - P0-03: 覆盖 7 种 interaction_type 的结构化答案提交
  - 旧端点 410 验证：AI Engine /word-games/* + API /sessions POST
"""
import sys
import time
import uuid

import requests

BASE = "https://maxiuquan-xuexi.hf.space"
ADMIN_USER = "maxiuquan@163.com"
ADMIN_PASS = "Admin@12345678"
STUDENT_USER = "student@163.com"
STUDENT_PASS = "Student@123456"

results = []


def log(category, path, method, status_code, detail=""):
    icon = "OK " if 200 <= status_code < 300 else "ERR"
    short = path.replace("/api/v1", "")
    msg = f"  [{category}] {icon} {status_code} {method} {short}"
    if detail:
        msg += f"  {detail}"
    print(msg)
    results.append((category, path, method, status_code, 200 <= status_code < 300))


def login(user=ADMIN_USER, pwd=ADMIN_PASS):
    """登录获取 token"""
    r = requests.post(
        f"{BASE}/api/v1/auth/login",
        json={"username": user, "password": pwd},
        timeout=30,
    )
    if r.status_code != 200:
        print(f"LOGIN FAILED: {r.status_code} {r.text[:200]}")
        sys.exit(1)
    token = r.json().get("access_token")
    if not token:
        print(f"NO TOKEN: {r.text[:200]}")
        sys.exit(1)
    print(f"Login OK ({user}), token={token[:20]}...")
    return token


# ──────────────────────────────────────────────────────────────
# 基础端点测试（保留原有结构）
# ──────────────────────────────────────────────────────────────


def test_health():
    """健康检查（无需认证）"""
    print("\n=== 健康检查 ===")
    for p in ["/health", "/health/ready", "/keepalive", "/payments/status"]:
        try:
            r = requests.get(f"{BASE}{p}", timeout=15)
            log("health", p, "GET", r.status_code, r.text[:80])
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

    r2 = requests.get(f"{BASE}/api/v1/questions/recommend?count=5", headers=h, timeout=15)
    detail2 = ""
    if r2.status_code == 200:
        d = r2.json()
        detail2 = f"count={len(d.get('questions', []))}"
    log("questions", "/questions/recommend", "GET", r2.status_code, detail2)

    if question_id:
        r3 = requests.get(f"{BASE}/api/v1/questions/{question_id}", headers=h, timeout=15)
        log("questions", f"/questions/{question_id}", "GET", r3.status_code)

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
    r = requests.get(f"{BASE}/api/v1/vocab/words?page=1&page_size=10", headers=h, timeout=15)
    detail = ""
    if r.status_code == 200:
        d = r.json()
        detail = f"total={d.get('total', 'N/A')}"
    log("vocab", "/vocab/words", "GET", r.status_code, detail)

    r2 = requests.get(f"{BASE}/api/v1/vocab/progress", headers=h, timeout=15)
    log("vocab", "/vocab/progress", "GET", r2.status_code)

    r3 = requests.get(f"{BASE}/api/v1/vocab/due", headers=h, timeout=15)
    log("vocab", "/vocab/due", "GET", r3.status_code)


def test_knowledge(h):
    print("\n=== 知识点 ===")
    r = requests.get(f"{BASE}/api/v1/knowledge/search?q=函数&page=1&page_size=10", headers=h, timeout=15)
    log("knowledge", "/knowledge/search", "GET", r.status_code)

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


def test_wrong_questions(h):
    print("\n=== 错题本 ===")
    r = requests.get(f"{BASE}/api/v1/wrong-questions", headers=h, timeout=15)
    log("wrong-questions", "/wrong-questions", "GET", r.status_code)


# ──────────────────────────────────────────────────────────────
# R8 重点：游戏三段式 API 测试（全部 25 款参数化）
# ──────────────────────────────────────────────────────────────


# 期望的 25 款游戏 ID（与 data/games/games-config.json 保持一致）
EXPECTED_GAME_IDS = [
    "word-match-blast",
    "spelling-bee",
    "root-affix-tree",
    "cloze-sprint",
    "sentence-untangle",
    "vocabulary-duel",
    "flashcard-rush",
    "listening-dash",
    "word-chain",
    "word-bubble-pop",
    "synonym-antonym-match",
    "picture-word-match",
    "crossword-quest",
    "word-form-master",
    "high-frequency-challenge",
    "memory-flip-match",
    "limit-blitz",
    "formula-link",
    "proof-step-sort",
    "problem-quest-map",
    "wrong-question-boss",
    "daily-quiz-arena",
    "knowledge-combo-streak",
    "memory-maze",
    "study-team-raid",
]

# 交互类型 → 是否使用 structured_answer
# 用于测试覆盖校验：multiple_choice/spelling/fill_blank/listen_select 使用 answer 字段；
# tap_match/drag_sort/word_bank 使用 structured_answer 字段
INTERACTION_USES_STRUCTURED = {
    "multiple_choice": False,
    "tap_match": True,
    "listen_select": False,
    "spelling": False,
    "drag_sort": True,
    "word_bank": True,
    "fill_blank": False,
}


def _build_answer_for_question(q, interaction_type):
    """根据题目字段与交互类型，构造一个 plausible structured_answer 或 answer。

    策略：
    - tap_match: 题目含 pairs=[{left, right}]，提交 {"pairs": [[left, right]]}（应该判正）
    - drag_sort: 题目含 sort_items=[...]，提交 {"ordered_item_ids": sort_items}（按题目给出的顺序，可能正可能误）
    - word_bank: 题目含 blanks=[{id, answer}]，提交 {"blanks": {id: answer}}（应该判正）
    - listen_select/spelling/fill_blank/multiple_choice: 用 prompt 作为 answer（不一定对，用于测试流程）
    """
    if interaction_type == "tap_match":
        pairs = q.get("pairs") or []
        if pairs:
            return None, {"pairs": [[p.get("left", ""), p.get("right", "")] for p in pairs]}
    if interaction_type == "drag_sort":
        sort_items = q.get("sort_items") or []
        if sort_items:
            return None, {"ordered_item_ids": list(sort_items)}
    if interaction_type == "word_bank":
        blanks = q.get("blanks") or []
        if blanks:
            return None, {"blanks": {b.get("id", "b1"): b.get("answer", "") for b in blanks}}
    # 简单交互类型 — 用 prompt 作为 answer
    return q.get("prompt", ""), None


def _play_one_game(h, game_id, expect_questions=True):
    """对单个游戏执行完整三段式流程：start → answers → finish → summary。

    返回 (session_id, summary_dict, ok) 元组，ok=False 表示流程失败。
    """
    short_id = game_id[:24]
    print(f"\n  ── 游戏: {short_id} ──")

    # 1) start
    try:
        r_start = requests.post(
            f"{BASE}/api/v1/games/{game_id}/sessions/start",
            json={"game_id": game_id},
            headers=h,
            timeout=30,
        )
    except Exception as e:
        log("games-start", f"/games/{game_id}/sessions/start", "POST", 0, str(e)[:50])
        return None, None, False

    if r_start.status_code != 200:
        log("games-start", f"/games/{game_id}/sessions/start", "POST",
            r_start.status_code, r_start.text[:120])
        return None, None, False

    start_data = r_start.json()
    session_id = start_data.get("session_id")
    questions = start_data.get("questions", [])
    interaction_type = start_data.get("interaction_type", "multiple_choice")
    game_name = start_data.get("game_name", game_id)

    if not session_id or not questions:
        log("games-start", f"/games/{game_id}/sessions/start", "POST", 200,
            f"BAD: session_id={session_id} questions={len(questions)}")
        return session_id, None, False

    # P0-02 验证：响应中 correct_answer 必须被剥离
    leaked = [q for q in questions if "correct_answer" in q]
    if leaked:
        log("games-start", f"/games/{game_id}/sessions/start", "POST", 200,
            f"P0-02 LEAK: correct_answer leaked in {len(leaked)} questions!")

    log("games-start", f"/games/{game_id}/sessions/start", "POST", 200,
        f"sid={session_id} q={len(questions)} type={interaction_type} name={game_name[:12]}")

    if not expect_questions:
        return session_id, None, True

    # 2) answers — 逐题提交
    correct_count = 0
    for q in questions:
        seq = q.get("sequence", 0)
        qid = q.get("question_id", "")
        ans, structured = _build_answer_for_question(q, interaction_type)
        idem_key = f"e2e-{session_id}-{seq}-{uuid.uuid4().hex[:8]}"

        body = {
            "question_id": qid,
            "sequence": seq,
            "idempotency_key": idem_key,
        }
        if structured is not None:
            body["structured_answer"] = structured
        else:
            body["answer"] = ans or ""

        try:
            r_ans = requests.post(
                f"{BASE}/api/v1/games/{game_id}/sessions/{session_id}/answers",
                json=body,
                headers=h,
                timeout=20,
            )
        except Exception as e:
            log("games-answer", f"/games/{game_id}/sessions/{session_id}/answers",
                "POST", 0, f"seq={seq} {str(e)[:40]}")
            continue

        if r_ans.status_code != 200:
            log("games-answer", f"/games/{game_id}/sessions/{session_id}/answers",
                "POST", r_ans.status_code,
                f"seq={seq} body={r_ans.text[:80]}")
            continue

        ans_data = r_ans.json()
        # P0-02 验证：correct_answer 在 submit 响应中必须是 None
        if ans_data.get("correct_answer") is not None:
            log("games-answer", f"/games/{game_id}/sessions/{session_id}/answers",
                "POST", 200, f"P0-02 LEAK: correct_answer in response seq={seq}!")
        if ans_data.get("is_correct"):
            correct_count += 1

    log("games-answer", f"/games/{game_id}/sessions/{session_id}/answers", "POST", 200,
        f"correct={correct_count}/{len(questions)}")

    # 3) finish
    try:
        r_fin = requests.post(
            f"{BASE}/api/v1/games/{game_id}/sessions/{session_id}/finish",
            json={},
            headers=h,
            timeout=30,
        )
    except Exception as e:
        log("games-finish", f"/games/{game_id}/sessions/{session_id}/finish", "POST", 0, str(e)[:50])
        return session_id, None, False

    if r_fin.status_code != 200:
        log("games-finish", f"/games/{game_id}/sessions/{session_id}/finish", "POST",
            r_fin.status_code, r_fin.text[:120])
        return session_id, None, False

    fin_data = r_fin.json()
    log("games-finish", f"/games/{game_id}/sessions/{session_id}/finish", "POST", 200,
        f"score={fin_data.get('score')} acc={fin_data.get('accuracy')} "
        f"xp={fin_data.get('xp_gained')} coins={fin_data.get('coins_gained')}")

    # 4) summary
    try:
        r_sum = requests.get(
            f"{BASE}/api/v1/games/{game_id}/sessions/{session_id}/summary",
            headers=h,
            timeout=20,
        )
    except Exception as e:
        log("games-summary", f"/games/{game_id}/sessions/{session_id}/summary", "GET", 0, str(e)[:50])
        return session_id, None, False

    if r_sum.status_code != 200:
        log("games-summary", f"/games/{game_id}/sessions/{session_id}/summary",
            "GET", r_sum.status_code, r_sum.text[:120])
        return session_id, None, False

    sum_data = r_sum.json()
    log("games-summary", f"/games/{game_id}/sessions/{session_id}/summary", "GET", 200,
        f"correct_items={len(sum_data.get('correct_items', []))} "
        f"wrong_items={len(sum_data.get('wrong_items', []))}")

    return session_id, sum_data, True


def test_games_list_and_25_games(h):
    """R8 P0-01: 全部 25 款游戏走三段式 API."""
    print("\n" + "=" * 60)
    print("=== 游戏：列表 + 全部 25 款参数化 E2E ===")
    print("=" * 60)

    # 游戏列表
    r = requests.get(f"{BASE}/api/v1/games", headers=h, timeout=15)
    detail = ""
    api_game_ids = []
    if r.status_code == 200:
        d = r.json()
        games = d.get("games", [])
        detail = f"count={len(games)}"
        api_game_ids = [g.get("game_id") for g in games]
    log("games", "/games", "GET", r.status_code, detail)

    # 校验 25 款全部存在
    missing = [gid for gid in EXPECTED_GAME_IDS if gid not in api_game_ids]
    if missing:
        log("games", "/games", "GET", 200, f"MISSING games: {missing}")
    else:
        print(f"  [CHECK] 全部 25 款游戏存在于配置中 ✓")

    # 校验字段（subject/type/icon/implementation_status）
    if r.status_code == 200:
        games = r.json().get("games", [])
        incomplete = []
        for g in games:
            gid = g.get("game_id", "?")
            if not g.get("subject"):
                incomplete.append(f"{gid}.subject")
            if not g.get("type"):
                incomplete.append(f"{gid}.type")
            if not g.get("icon"):
                incomplete.append(f"{gid}.icon")
        if incomplete:
            log("games", "/games", "GET", 200, f"INCOMPLETE fields: {incomplete[:5]}")
        else:
            print(f"  [CHECK] 全部游戏含 subject/type/icon 字段 ✓")

    # 遍历执行 25 款
    ok_games = 0
    fail_games = 0
    for gid in EXPECTED_GAME_IDS:
        try:
            _, _, ok = _play_one_game(h, gid, expect_questions=True)
            if ok:
                ok_games += 1
            else:
                fail_games += 1
        except Exception as e:
            print(f"  [ERR] {gid}: {str(e)[:100]}")
            fail_games += 1

    print(f"\n  ── 游戏汇总: OK={ok_games}/{len(EXPECTED_GAME_IDS)} FAIL={fail_games} ──")
    return ok_games, fail_games


# ──────────────────────────────────────────────────────────────
# R8 异常场景测试
# ──────────────────────────────────────────────────────────────


def test_abnormal_scenarios(h_admin, h_student):
    """R8 P0-03: 异常场景 — 错答案/重复提交/越序/跨用户."""
    print("\n" + "=" * 60)
    print("=== 异常场景测试 ===")
    print("=" * 60)

    gid = "vocabulary-duel"  # 使用 multiple_choice 类型

    # 准备一个有效 session
    r_start = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/start",
        json={"game_id": gid},
        headers=h_admin,
        timeout=30,
    )
    if r_start.status_code != 200:
        print(f"  [SKIP] 异常场景测试需要有效 session，但 start 失败: {r_start.status_code}")
        return
    session = r_start.json()
    session_id = session["session_id"]
    questions = session["questions"]
    q0 = questions[0]
    print(f"  [SETUP] session_id={session_id} q_count={len(questions)}")

    # ── 场景 1: 错答案 ──
    print("\n  ── 场景 1: 错误答案 → is_correct=False ──")
    body = {
        "question_id": q0["question_id"],
        "sequence": q0["sequence"],
        "answer": "__definitely_wrong_answer__",
        "idempotency_key": f"ab-wrong-{uuid.uuid4().hex[:12]}",
    }
    r = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/{session_id}/answers",
        json=body,
        headers=h_admin,
        timeout=20,
    )
    if r.status_code == 200:
        d = r.json()
        is_correct = d.get("is_correct")
        # 错答案应该被判定为错误（除非特殊情况下匹配，但 __definitely_wrong_answer__ 不会匹配任何答案）
        if is_correct is False:
            print(f"  [PASS] 错答案 → is_correct=False ✓")
            log("abnormal", f"/games/{gid}/.../answers (wrong)", "POST", 200, "is_correct=False ✓")
        else:
            print(f"  [WARN] 错答案意外判正 is_correct={is_correct}")
            log("abnormal", f"/games/{gid}/.../answers (wrong)", "POST", 200, f"is_correct={is_correct} ⚠")
    else:
        log("abnormal", f"/games/{gid}/.../answers (wrong)", "POST", r.status_code, r.text[:80])

    # ── 场景 2: 重复提交（同 idempotency_key）──
    print("\n  ── 场景 2: 重复提交同 idempotency_key → 409 Conflict ──")
    q1 = questions[1] if len(questions) > 1 else q0
    idem_key = f"ab-dup-{uuid.uuid4().hex[:12]}"
    body1 = {
        "question_id": q1["question_id"],
        "sequence": q1["sequence"],
        "answer": "some-answer",
        "idempotency_key": idem_key,
    }
    # 第一次提交
    r1 = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/{session_id}/answers",
        json=body1,
        headers=h_admin,
        timeout=20,
    )
    log("abnormal", f"/games/{gid}/.../answers (dup-1st)", "POST", r1.status_code)
    # 第二次同 key
    r2 = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/{session_id}/answers",
        json=body1,
        headers=h_admin,
        timeout=20,
    )
    if r2.status_code == 409:
        print(f"  [PASS] 重复 idempotency_key → 409 Conflict ✓")
        log("abnormal", f"/games/{gid}/.../answers (dup-2nd)", "POST", 409, "Conflict ✓")
    else:
        log("abnormal", f"/games/{gid}/.../answers (dup-2nd)", "POST", r2.status_code,
            f"expected 409, got {r2.status_code}")

    # ── 场景 3: 越序 sequence ──
    print("\n  ── 场景 3: 越序 sequence → 404 Not Found ──")
    fake_seq = 9999
    body3 = {
        "question_id": "fake-qid",
        "sequence": fake_seq,
        "answer": "x",
        "idempotency_key": f"ab-seq-{uuid.uuid4().hex[:12]}",
    }
    r3 = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/{session_id}/answers",
        json=body3,
        headers=h_admin,
        timeout=20,
    )
    if r3.status_code == 404:
        print(f"  [PASS] 越序 sequence={fake_seq} → 404 Not Found ✓")
        log("abnormal", f"/games/{gid}/.../answers (ofo)", "POST", 404, "Not Found ✓")
    else:
        log("abnormal", f"/games/{gid}/.../answers (ofo)", "POST", r3.status_code,
            f"expected 404, got {r3.status_code}")

    # ── 场景 4: 跨用户访问 session ──
    print("\n  ── 场景 4: 跨用户访问 session → 404 Not Found ──")
    if h_student:
        body4 = {
            "question_id": q0["question_id"],
            "sequence": q0["sequence"],
            "answer": "student-answer",
            "idempotency_key": f"ab-xuser-{uuid.uuid4().hex[:12]}",
        }
        r4 = requests.post(
            f"{BASE}/api/v1/games/{gid}/sessions/{session_id}/answers",
            json=body4,
            headers=h_student,
            timeout=20,
        )
        if r4.status_code == 404:
            print(f"  [PASS] 跨用户访问 → 404 Not Found ✓")
            log("abnormal", f"/games/{gid}/.../answers (xuser)", "POST", 404, "Not Found ✓")
        else:
            log("abnormal", f"/games/{gid}/.../answers (xuser)", "POST", r4.status_code,
                f"expected 404, got {r4.status_code}")

    # ── 场景 5: 不存在的 session ──
    print("\n  ── 场景 5: 不存在 session_id → 404 Not Found ──")
    fake_sid = 99999999
    body5 = {
        "question_id": "fake",
        "sequence": 0,
        "answer": "x",
        "idempotency_key": f"ab-nosid-{uuid.uuid4().hex[:12]}",
    }
    r5 = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/{fake_sid}/answers",
        json=body5,
        headers=h_admin,
        timeout=20,
    )
    if r5.status_code == 404:
        print(f"  [PASS] 不存在 session_id={fake_sid} → 404 Not Found ✓")
        log("abnormal", f"/games/{gid}/sessions/{fake_sid}/answers", "POST", 404, "Not Found ✓")
    else:
        log("abnormal", f"/games/{gid}/sessions/{fake_sid}/answers", "POST", r5.status_code,
            f"expected 404, got {r5.status_code}")

    # ── 场景 6: 缺少 answer 与 structured_answer ──
    print("\n  ── 场景 6: 缺少 answer 与 structured_answer → 400 ──")
    body6 = {
        "question_id": q0["question_id"],
        "sequence": q0["sequence"],
        "idempotency_key": f"ab-noans-{uuid.uuid4().hex[:12]}",
    }
    # 上面场景 1 已用 sequence 0，这里换一个未答的题
    unused_q = next((q for q in questions if q["sequence"] != 0), q0)
    body6["question_id"] = unused_q["question_id"]
    body6["sequence"] = unused_q["sequence"]
    r6 = requests.post(
        f"{BASE}/api/v1/games/{gid}/sessions/{session_id}/answers",
        json=body6,
        headers=h_admin,
        timeout=20,
    )
    if r6.status_code == 400:
        print(f"  [PASS] 缺少 answer 与 structured_answer → 400 ✓")
        log("abnormal", f"/games/{gid}/.../answers (noans)", "POST", 400, "Bad Request ✓")
    else:
        log("abnormal", f"/games/{gid}/.../answers (noans)", "POST", r6.status_code,
            f"expected 400, got {r6.status_code}")


# ──────────────────────────────────────────────────────────────
# R8 P0-01: 旧端点必须 410 Gone 验证
# ──────────────────────────────────────────────────────────────


def test_legacy_endpoints_return_410(h):
    """R8 P0-01: AI Engine 4 个旧业务端点 + API 旧 session 提交端点必须返回 410 Gone."""
    print("\n" + "=" * 60)
    print("=== 旧端点 410 Gone 验证 ===")
    print("=" * 60)

    gid = "vocabulary-duel"

    # ── AI Engine 4 个旧端点（经 nginx 反代到 /word-games/*）──
    legacy_endpoints = [
        ("POST", "/word-games/start", {"game_type": gid, "user_id": 1, "difficulty": "easy"}),
        ("POST", "/word-games/submit", {"session_id": "fake", "question_id": "fake", "answer": "x"}),
        ("GET",  "/word-games/summary/fake-session", None),
        ("POST", "/word-games/leaderboard", {"game_type": gid, "scope": "global", "limit": 10}),
    ]
    for method, path, body in legacy_endpoints:
        try:
            if method == "POST":
                r = requests.post(f"{BASE}{path}", json=body, headers=h, timeout=15)
            else:
                r = requests.get(f"{BASE}{path}", headers=h, timeout=15)
            if r.status_code == 410:
                print(f"  [PASS] {method} {path} → 410 Gone ✓")
                log("legacy-410", path, method, 410, "Gone ✓")
            else:
                log("legacy-410", path, method, r.status_code,
                    f"expected 410, got {r.status_code}: {r.text[:80]}")
        except Exception as e:
            log("legacy-410", path, method, 0, str(e)[:50])

    # AI Engine 保留的端点应该正常
    for path in ["/word-games/game-types", "/word-games/health"]:
        try:
            r = requests.get(f"{BASE}{path}", headers=h, timeout=15)
            log("legacy-keep", path, "GET", r.status_code)
        except Exception as e:
            log("legacy-keep", path, "GET", 0, str(e)[:50])

    # ── API 旧 session 提交端点 ──
    print("\n  ── API 旧 POST /api/v1/games/{gid}/sessions 应返回 410 ──")
    body = {
        "game_id": gid,
        "score": 80,
        "accuracy": 0.8,
        "duration": 60,
        "started_at": "2026-07-14T10:00:00Z",
        "finished_at": "2026-07-14T10:01:00Z",
        "nonce": "test-nonce-12345678",
    }
    try:
        r = requests.post(
            f"{BASE}/api/v1/games/{gid}/sessions",
            json=body,
            headers=h,
            timeout=15,
        )
        if r.status_code == 410:
            print(f"  [PASS] POST /api/v1/games/{gid}/sessions → 410 Gone ✓")
            log("legacy-410", f"/api/v1/games/{gid}/sessions", "POST", 410, "Gone ✓")
        else:
            log("legacy-410", f"/api/v1/games/{gid}/sessions", "POST", r.status_code,
                f"expected 410, got {r.status_code}: {r.text[:80]}")
    except Exception as e:
        log("legacy-410", f"/api/v1/games/{gid}/sessions", "POST", 0, str(e)[:50])

    # ── 排行榜 friends 501 验证（R8 P1-03）──
    print("\n  ── 排行榜 /api/v1/games/leaderboards/friends → 501 ──")
    try:
        r = requests.get(
            f"{BASE}/api/v1/games/leaderboards/friends",
            headers=h,
            timeout=15,
        )
        if r.status_code == 501:
            print(f"  [PASS] friends 排行榜 → 501 Not Implemented ✓")
            log("legacy-410", "/api/v1/games/leaderboards/friends", "GET", 501, "Not Implemented ✓")
        else:
            log("legacy-410", "/api/v1/games/leaderboards/friends", "GET", r.status_code,
                f"expected 501, got {r.status_code}")
    except Exception as e:
        log("legacy-410", "/api/v1/games/leaderboards/friends", "GET", 0, str(e)[:50])

    # ── 全局排行榜应正常返回 200 ──
    try:
        r = requests.get(
            f"{BASE}/api/v1/games/leaderboards/global",
            headers=h,
            timeout=15,
        )
        log("games", "/games/leaderboards/global", "GET", r.status_code)
    except Exception as e:
        log("games", "/games/leaderboards/global", "GET", 0, str(e)[:50])


# ──────────────────────────────────────────────────────────────
# 主入口
# ──────────────────────────────────────────────────────────────


def main():
    print("=" * 60)
    print("SmartLearn AI 全面端到端测试（R8 三段式游戏 API 重写版）")
    print(f"URL: {BASE}")
    print(f"Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 管理员登录
    admin_token = login(ADMIN_USER, ADMIN_PASS)
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    # 学生登录（用于跨用户验证）
    h_student = None
    try:
        student_token = login(STUDENT_USER, STUDENT_PASS)
        h_student = {"Authorization": f"Bearer {student_token}"}
    except SystemExit:
        print("  [WARN] 学生登录失败，跳过跨用户测试")

    # 基础端点
    test_health()
    test_auth(h_admin)
    test_statistics(h_admin)
    test_system(h_admin)
    test_users(h_admin)
    test_audit(h_admin)
    test_questions(h_admin)
    test_vocab(h_admin)
    test_knowledge(h_admin)
    test_admin_data(h_admin)
    test_wrong_questions(h_admin)

    # R8 重点：25 款游戏三段式 E2E
    ok_games, fail_games = test_games_list_and_25_games(h_admin)

    # R8 异常场景
    test_abnormal_scenarios(h_admin, h_student)

    # R8 P0-01: 旧端点 410 验证
    test_legacy_endpoints_return_410(h_admin)

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
        status_str = "PASS" if fail == 0 else "FAIL"
        print(f"  [{status_str}] {cat:25s} OK={ok} FAIL={fail}")

    print(f"\n  总计: OK={total_ok} FAIL={total_fail}")
    print(f"  25 款游戏: OK={ok_games} FAIL={fail_games}")

    if total_fail == 0 and fail_games == 0:
        print("\n  *** 全部测试通过 ***")
        return 0
    else:
        print(f"\n  *** {total_fail} 个测试失败 + {fail_games} 款游戏失败 ***")
        return 1


if __name__ == "__main__":
    sys.exit(main())
