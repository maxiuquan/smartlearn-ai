#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Download past exam papers from 4 GitHub repos, parse markdown, and generate JSON.

Sources:
1. 考研数学一: github.com/TsekaLuk/Kaoyan-Math1-Papers
2. 考研数学二: github.com/TsekaLuk/Kaoyan-Math2-Papers
3. 考研英语一和英语二: github.com/Fantasia1999/kaoyanzhenti
4. 英语四六级: github.com/DieDiDi/CET4-6-past-exam-paper

Outputs (to apps/student-web/public/exam-papers/):
- math1-exams.json
- math2-exams.json
- english1-2-exams.json
- cet4-6-exams.json
"""

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import httpx

# ─── Paths ───
BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "md_cache"
OUTPUT_DIR = BASE_DIR.parent / "apps" / "student-web" / "public" / "exam-papers"

# ─── Repo constants ───
MATH1_REPO = "TsekaLuk/Kaoyan-Math1-Papers"
MATH2_REPO = "TsekaLuk/Kaoyan-Math2-Papers"
ENG_REPO = "Fantasia1999/kaoyanzhenti"
CET_REPO = "DieDiDi/CET4-6-past-exam-paper"

# ─── HTTP client ───
_client = None


def get_client():
    global _client
    if _client is None:
        _client = httpx.Client(
            timeout=60,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; exam-import-script/1.0)"},
        )
    return _client


def close_client():
    global _client
    if _client:
        _client.close()
        _client = None


# ─── GitHub API helpers ───

def github_api_get(url, max_retries=3):
    """GET a GitHub API URL with rate-limit retry."""
    client = get_client()
    for attempt in range(max_retries):
        try:
            resp = client.get(url)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 403 and "rate limit" in resp.text.lower():
                wait = 30 * (attempt + 1)
                print(f"    API rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            if resp.status_code == 404:
                return None
            print(f"    API HTTP {resp.status_code}: {url}")
            return None
        except Exception as e:
            print(f"    API error: {e}")
            time.sleep(5)
    return None


def get_repo_tree(owner_repo, branch="main"):
    """Fetch the full recursive file tree of a repo (single API call)."""
    url = f"https://api.github.com/repos/{owner_repo}/git/trees/{branch}?recursive=1"
    data = github_api_get(url)
    if data and "tree" in data:
        return data["tree"]
    # Try master if main fails
    if branch == "main":
        print(f"    Trying master branch for {owner_repo}...")
        return get_repo_tree(owner_repo, "master")
    return []


def list_md_files_in_tree(tree, path_prefix=""):
    """Extract all .md file paths from a repo tree, optionally filtered by prefix."""
    md_files = []
    for item in tree:
        if item.get("type") == "blob" and item.get("path", "").endswith(".md"):
            path = item["path"]
            if not path_prefix or path.startswith(path_prefix):
                md_files.append(path)
    return md_files


def download_raw(owner_repo, branch, filepath, cache_path):
    """Download a raw file from GitHub, with local caching."""
    if cache_path.exists():
        try:
            return cache_path.read_text(encoding="utf-8")
        except Exception:
            pass
    encoded = quote(filepath, safe="/")
    url = f"https://raw.githubusercontent.com/{owner_repo}/{branch}/{encoded}"
    client = get_client()
    for attempt in range(2):
        try:
            resp = client.get(url)
            if resp.status_code == 200:
                text = resp.text
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(text, encoding="utf-8")
                return text
            if resp.status_code == 404:
                return None
            print(f"    HTTP {resp.status_code} for {filepath}")
            return None
        except Exception as e:
            print(f"    Download error: {e}")
            time.sleep(2)
    return None


# ─── Math markdown parsing ───

def _clean_math_text(text):
    """Clean up math markdown text."""
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", "", text)
    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _extract_year_from_filename(filename, subject="math1"):
    """Extract year from filename like '2020年考研数学(一)真题.md' or '2025年数学一真题.md'."""
    m = re.search(r"(20\d{2}|19\d{2})", filename)
    if m:
        return m.group(1)
    return None


def parse_math_paper(md_text, year, subject_label, category):
    """Parse a math exam paper markdown into questions list.

    Handles sections: 选择题(choice), 填空题(fill), 解答题/计算题(calculation), 证明题(proof)
    """
    if not md_text:
        return []

    md_text = _clean_math_text(md_text)
    questions = []
    q_counter = 0

    # ─── Split into sections by headers ───
    # Headers like: # 一、选择题, ## 二、填空题, # 三、解答题
    section_pattern = re.compile(
        r"^#{1,3}\s*[一二三四五六七八九十]+[、.．]\s*(选择|填空|解答|计算|证明|应用)",
        re.MULTILINE,
    )
    sections = []
    for m in section_pattern.finditer(md_text):
        section_type = m.group(1)
        start = m.start()
        # Find the next section header or end
        next_m = section_pattern.search(md_text, m.end())
        end = next_m.start() if next_m else len(md_text)
        sections.append((section_type, md_text[start:end]))

    # If no sections found, try alternative parsing with plain text markers
    if not sections:
        # Try without the # header prefix
        section_pattern2 = re.compile(
            r"^[一二三四五六七八九十]+[、.．]\s*(选择|填空|解答|计算|证明|应用)",
            re.MULTILINE,
        )
        for m in section_pattern2.finditer(md_text):
            section_type = m.group(1)
            start = m.start()
            next_m = section_pattern2.search(md_text, m.end())
            end = next_m.start() if next_m else len(md_text)
            sections.append((section_type, md_text[start:end]))

    for section_type, section_text in sections:
        if section_type == "选择":
            qs = _parse_math_choice(section_text, year, subject_label, category)
            questions.extend(qs)
        elif section_type == "填空":
            qs = _parse_math_fill(section_text, year, subject_label, category)
            questions.extend(qs)
        elif section_type in ("解答", "计算", "应用"):
            qs = _parse_math_calculation(section_text, year, subject_label, category)
            questions.extend(qs)
        elif section_type == "证明":
            qs = _parse_math_proof(section_text, year, subject_label, category)
            questions.extend(qs)

    # Renumber questions sequentially
    for i, q in enumerate(questions, 1):
        q["number"] = i
        q["id"] = f"{category}-{year}-q{i}"

    return questions


def _parse_math_choice(section_text, year, subject_label, category):
    """Parse choice questions from a math section."""
    questions = []

    # Pattern: number) content... (A) ... (B) ... (C) ... (D) ...
    # Numbers can be (1), 1., 1）, etc.
    # Options: (A) text, A. text, A）text
    q_pattern = re.compile(
        r"(?:^|\n)\s*[\(（]?(\d+)[\)）\.．、]\s*(.+?)(?=\n\s*[\(（]?\d+[\)）\.．、]|\Z)",
        re.DOTALL,
    )

    for m in q_pattern.finditer(section_text):
        qnum_str = m.group(1)
        qbody = m.group(2).strip()
        qnum = int(qnum_str)

        # Skip header lines
        if "选择题" in qbody and len(qbody) < 30:
            continue

        # Extract options: (A) text, （A）text, A. text, A、text
        opts = {}
        opt_pattern = re.compile(
            r"[\(（]?\s*([A-D])\s*[\)）\.．、]\s*(.+?)(?=[\(（]?\s*[A-D]\s*[\)）\.．、]|\Z)",
            re.DOTALL,
        )
        for om in opt_pattern.finditer(qbody):
            letter = om.group(1)
            text = om.group(2).strip()
            text = re.sub(r"\s+", " ", text)
            text = text.rstrip(".,;，。；")
            if text:
                opts[letter] = text

        # Extract question content (before first option)
        first_opt = re.search(r"[\(（]?\s*[A-D]\s*[\)）\.．、]", qbody)
        if first_opt:
            content = qbody[: first_opt.start()].strip()
        else:
            content = qbody.strip()

        content = re.sub(r"\s+", " ", content).strip()
        # Clean up leading/trailing punctuation
        content = content.strip("（）()")

        # Only add if we have at least 2 options and some content
        if len(opts) >= 2 and content:
            # Ensure we have A,B,C,D (pad if needed)
            for letter in "ABCD":
                if letter not in opts:
                    opts[letter] = ""
            opts = {k: opts[k] for k in "ABCD"}

            # Try to find answer in 【答案】X format
            answer = _find_answer_marker(section_text, qnum)
            solution = _find_solution_marker(section_text, qnum)

            questions.append({
                "id": "",  # Will be set later
                "number": qnum,
                "type": "choice",
                "score": 4,
                "content": content,
                "options": opts,
                "answer": answer or "A",
                "solution": solution or "答案待核实，请以官方公布为准。",
                "analysis": "选择题",
                "knowledge_points": ["math-choice"],
                "difficulty": 3,
                "tags": ["选择题", f"{year}年{subject_label}"],
            })

    return questions


def _parse_math_fill(section_text, year, subject_label, category):
    """Parse fill-in-the-blank questions from a math section."""
    questions = []

    q_pattern = re.compile(
        r"(?:^|\n)\s*[\(（]?(\d+)[\)）\.．、]\s*(.+?)(?=\n\s*[\(（]?\d+[\)）\.．、]|\Z)",
        re.DOTALL,
    )

    for m in q_pattern.finditer(section_text):
        qnum_str = m.group(1)
        qbody = m.group(2).strip()
        qnum = int(qnum_str)

        if "填空题" in qbody and len(qbody) < 30:
            continue

        content = re.sub(r"\s+", " ", qbody).strip()
        content = content.strip("（）()")

        if not content or len(content) < 5:
            continue

        answer = _find_answer_marker(section_text, qnum)
        solution = _find_solution_marker(section_text, qnum)

        questions.append({
            "id": "",
            "number": qnum,
            "type": "fill",
            "score": 4,
            "content": content,
            "options": {},
            "answer": answer or "待补充",
            "solution": solution or "答案待核实，请以官方公布为准。",
            "analysis": "填空题",
            "knowledge_points": ["math-fill"],
            "difficulty": 3,
            "tags": ["填空题", f"{year}年{subject_label}"],
        })

    return questions


def _parse_math_calculation(section_text, year, subject_label, category):
    """Parse calculation/solution questions from a math section."""
    questions = []

    q_pattern = re.compile(
        r"(?:^|\n)\s*[\(（]?(\d+)[\)）\.．、]\s*(.+?)(?=\n\s*[\(（]?\d+[\)）\.．、]|\Z)",
        re.DOTALL,
    )

    for m in q_pattern.finditer(section_text):
        qnum_str = m.group(1)
        qbody = m.group(2).strip()
        qnum = int(qnum_str)

        if "解答题" in qbody and len(qbody) < 30:
            continue

        content = re.sub(r"\s+", " ", qbody).strip()
        content = content.strip("（）()")

        if not content or len(content) < 5:
            continue

        answer = _find_answer_marker(section_text, qnum)
        solution = _find_solution_marker(section_text, qnum)

        questions.append({
            "id": "",
            "number": qnum,
            "type": "calculation",
            "score": 10,
            "content": content,
            "options": {},
            "answer": answer or "见解析",
            "solution": solution or "解题过程待补充，请参考相关教材。",
            "analysis": "解答题",
            "knowledge_points": ["math-calculation"],
            "difficulty": 4,
            "tags": ["解答题", f"{year}年{subject_label}"],
        })

    return questions


def _parse_math_proof(section_text, year, subject_label, category):
    """Parse proof questions from a math section."""
    questions = []

    q_pattern = re.compile(
        r"(?:^|\n)\s*[\(（]?(\d+)[\)）\.．、]\s*(.+?)(?=\n\s*[\(（]?\d+[\)）\.．、]|\Z)",
        re.DOTALL,
    )

    for m in q_pattern.finditer(section_text):
        qnum_str = m.group(1)
        qbody = m.group(2).strip()
        qnum = int(qnum_str)

        if "证明题" in qbody and len(qbody) < 30:
            continue

        content = re.sub(r"\s+", " ", qbody).strip()
        content = content.strip("（）()")

        if not content or len(content) < 5:
            continue

        answer = _find_answer_marker(section_text, qnum)
        solution = _find_solution_marker(section_text, qnum)

        questions.append({
            "id": "",
            "number": qnum,
            "type": "proof",
            "score": 10,
            "content": content,
            "options": {},
            "answer": answer or "见证明",
            "solution": solution or "证明过程待补充，请参考相关教材。",
            "analysis": "证明题",
            "knowledge_points": ["math-proof"],
            "difficulty": 4,
            "tags": ["证明题", f"{year}年{subject_label}"],
        })

    return questions


def _find_answer_marker(text, qnum):
    """Try to find 【答案】X marker for a given question number."""
    # Pattern: 【答案】B or 答案：B
    patterns = [
        rf"{qnum}[\.．、\s]*.*?【?答案】?\s*[：:]?\s*([A-D]|.+?)(?=\n|$)",
        rf"【答案】\s*{qnum}[\.\s]*[：:]?\s*([A-D]|.+?)(?=\n|$)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            ans = m.group(1).strip()
            # For choice questions, extract just the letter
            if len(ans) <= 2 and ans.upper() in "ABCD":
                return ans.upper()
            return ans
    return None


def _find_solution_marker(text, qnum):
    """Try to find 【解析】or 【解】marker for a given question number."""
    patterns = [
        rf"【解析】\s*(.+?)(?=【|\Z)",
        rf"【解】\s*(.+?)(?=【|\Z)",
    ]
    for pat in patterns:
        m = re.search(pat, text, re.DOTALL)
        if m:
            sol = m.group(1).strip()
            sol = re.sub(r"\s+", " ", sol)
            if len(sol) > 10:
                return sol[:500]  # Limit length
    return None


# ─── English markdown parsing (for Fantasia1999 repo) ───

def _strip_zwnj(text):
    """Remove zero-width non-joiner and other invisible chars."""
    return text.replace("\u200c", "").replace("\u200b", "").replace("\ufeff", "")


def parse_english_paper(md_text, year, subject_label, category):
    """Parse an English exam paper (cloze + reading) into questions list."""
    if not md_text:
        return []

    md_text = _strip_zwnj(md_text)
    questions = []
    q_counter = 0

    # Parse cloze (Section I / Use of English / 完形填空)
    cloze_qs = _parse_eng_cloze(md_text)
    for q in cloze_qs:
        q_counter += 1
        q["number"] = q_counter
        q["id"] = f"{category}-{year}-q{q_counter}"
        questions.append(q)

    # Parse reading comprehension
    reading_qs = _parse_eng_reading(md_text)
    for q in reading_qs:
        q_counter += 1
        q["number"] = q_counter
        q["id"] = f"{category}-{year}-q{q_counter}"
        questions.append(q)

    return questions


def _parse_eng_cloze(md_text):
    """Parse cloze/Use of English section (questions with 4 options A-D)."""
    questions = []

    # Find the cloze section
    cloze_match = re.search(
        r"(Section\s*I|Use\s+of\s+English|完形填空).*?(?=Section\s*II|阅读理解|Part\s*A|---)",
        md_text, re.DOTALL | re.IGNORECASE,
    )
    if not cloze_match:
        return []

    cloze_text = cloze_match.group(0)

    # Extract passage (before numbered options)
    passage = ""
    passage_match = re.search(r"(Directions:.*?)(?=\d+\.\s*\[)", cloze_text, re.DOTALL)
    if passage_match:
        passage = passage_match.group(1)
    else:
        passage_match = re.search(r"(.*?)(?=\d+\.\s*\[)", cloze_text, re.DOTALL)
        if passage_match:
            passage = passage_match.group(1)

    # Clean passage - remove span tags but keep blank numbers
    passage_clean = re.sub(r'<span class="long-underline">\s*(\d+)\s*</span>', r'_____\1_____', passage)
    passage_clean = re.sub(r"\*\*Directions:\*\*\s*_?", "", passage_clean)
    passage_clean = re.sub(r"_+", "_", passage_clean)

    # Parse options: "1. [A] text [B] text [C] text [D] text"
    q_pattern = re.compile(r"^(\d+)\.\s*(.+)$", re.MULTILINE)
    for m in q_pattern.finditer(cloze_text):
        qnum = int(m.group(1))
        if qnum < 1 or qnum > 20:
            continue
        line = m.group(2).strip()
        opts = {}
        opt_pattern = re.compile(r"\[?([A-D])\]?\s*(.+?)(?=\s*\[?[A-D]\]|$)")
        for om in opt_pattern.finditer(line):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(" ,;，。；")
            opts[letter] = text

        if len(opts) >= 4:
            opts = {k: opts[k] for k in "ABCD" if k in opts}
            if len(opts) == 4:
                # Extract context from passage
                blank_marker = f"_____{qnum}_____"
                if blank_marker in passage_clean:
                    idx = passage_clean.index(blank_marker)
                    start = max(0, idx - 80)
                    end = min(len(passage_clean), idx + len(blank_marker) + 80)
                    context = passage_clean[start:end].replace(blank_marker, "_____")
                    context = re.sub(r"\s+", " ", context).strip()
                else:
                    context = f"完形填空第{qnum}空"

                questions.append({
                    "id": "",
                    "number": qnum,
                    "type": "choice",
                    "score": 0.5,
                    "content": context,
                    "options": opts,
                    "answer": "A",
                    "solution": "完形填空题，答案待核实，请以官方公布为准。",
                    "analysis": "完形填空，词义辨析与上下文理解",
                    "knowledge_points": ["cloze-vocab"],
                    "difficulty": 3,
                    "tags": ["完形填空"],
                })

    return questions


def _parse_eng_reading(md_text):
    """Parse reading comprehension questions (with [A] [B] [C] [D] options)."""
    questions = []

    # Find reading section
    reading_match = re.search(
        r"(Section\s*II|Reading\s*Comprehension|阅读理解).*?(?=Section\s*III|Translation|翻译|Writing|写作|---|$)",
        md_text, re.DOTALL | re.IGNORECASE,
    )
    if not reading_match:
        return []

    reading_text = reading_match.group(0)

    # Parse questions with 2-digit numbers (21-40 typically)
    q_blocks = re.split(r"\n(?=\d{2}\.\s)", reading_text)

    for block in q_blocks:
        m = re.match(r"(\d{2})\.\s*(.+)", block.strip(), re.DOTALL)
        if not m:
            continue
        qnum = int(m.group(1))
        if qnum < 21 or qnum > 60:
            continue

        rest = m.group(2)
        opts = {}
        opt_pattern = re.compile(r"\[?([A-D])\]?\s*(.+?)(?=\s*\[?[A-D]\]|\s*$)", re.DOTALL)
        for om in opt_pattern.finditer(rest):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(" .,；")
            text = re.sub(r"\s+", " ", text).strip()
            opts[letter] = text

        first_opt = re.search(r"\[A\]", rest)
        if first_opt:
            stem = rest[: first_opt.start()].strip()
        else:
            stem = rest.strip()
        stem = re.sub(r"\s+", " ", stem).strip().rstrip(":：")

        if len(opts) >= 4 and stem:
            opts = {k: opts[k] for k in "ABCD" if k in opts}
            if len(opts) == 4:
                questions.append({
                    "id": "",
                    "number": qnum,
                    "type": "choice",
                    "score": 2,
                    "content": stem,
                    "options": opts,
                    "answer": "A",
                    "solution": "阅读理解题，答案待核实，请以官方公布为准。",
                    "analysis": "阅读理解，细节/推断/主旨题",
                    "knowledge_points": ["reading-comprehension"],
                    "difficulty": 3,
                    "tags": ["阅读理解"],
                })

    return questions


# ─── CET parsing (for DieDiDi repo) ───

def parse_cet_paper(md_text, year, month, set_n, level, category):
    """Parse a CET4/6 exam paper into questions list."""
    if not md_text:
        return []

    md_text = _strip_zwnj(md_text)
    questions = []
    q_counter = 0

    # Parse listening (Part II)
    listen_qs = _parse_cet_listening(md_text)
    for q in listen_qs:
        q_counter += 1
        q["number"] = q_counter
        q["id"] = f"{category}-{year}-{month}-{set_n}-q{q_counter}"
        questions.append(q)

    # Parse reading (Part III Section C - choice questions)
    reading_qs = _parse_cet_reading(md_text)
    for q in reading_qs:
        q_counter += 1
        q["number"] = q_counter
        q["id"] = f"{category}-{year}-{month}-{set_n}-q{q_counter}"
        questions.append(q)

    return questions


def _parse_cet_listening(md_text):
    """Parse CET listening questions."""
    questions = []

    listen_match = re.search(
        r"(Part\s*II|Listening\s*Comprehension|听力).*?(?=Part\s*III|Reading|阅读)",
        md_text, re.DOTALL | re.IGNORECASE,
    )
    if not listen_match:
        return []

    listen_text = listen_match.group(0)

    # Parse questions: "1. A) option B) option C) option D) option"
    q_pattern = re.compile(r"^(\d{1,2})\.\s", re.MULTILINE)
    q_positions = [(m.start(), int(m.group(1))) for m in q_pattern.finditer(listen_text)]

    # Capture context
    context_pattern = re.compile(
        r"\*{0,2}Questions?\s+(\d+)\s*(?:to\s*(\d+)|and\s*(\d+))?\s+are\s+based\s+on\s+(.+?)\*{0,2}",
        re.IGNORECASE,
    )
    contexts = {}
    for cm in context_pattern.finditer(listen_text):
        q_start = int(cm.group(1))
        q_end = int(cm.group(2) or cm.group(3) or q_start)
        ctx = cm.group(4).strip().rstrip(".")
        for qn in range(q_start, q_end + 1):
            contexts[qn] = ctx

    for i, (pos, qnum) in enumerate(q_positions):
        if qnum < 1 or qnum > 25:
            continue
        block = listen_text[pos:q_positions[i + 1][0]] if i + 1 < len(q_positions) else listen_text[pos:]

        opts = {}
        opt_pattern = re.compile(r"([A-D])\)\s*(.+?)(?=\s*[A-D]\)\s|\s*$)", re.DOTALL)
        for om in opt_pattern.finditer(block):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(" ,;，。；")
            text = re.sub(r"\s+", " ", text).strip()
            if text and letter not in opts:
                opts[letter] = text

        if len(opts) >= 4:
            opts = {k: opts[k] for k in "ABCD" if k in opts}
            if len(opts) == 4:
                ctx = contexts.get(qnum, "听力理解")
                questions.append({
                    "id": "",
                    "number": qnum,
                    "type": "choice",
                    "score": 7.1,
                    "content": f"听力理解第{qnum}题（{ctx}）",
                    "options": opts,
                    "answer": "A",
                    "solution": "听力理解题，答案待核实，请以官方公布为准。",
                    "analysis": "听力理解，需结合音频材料作答",
                    "knowledge_points": ["listening-comprehension"],
                    "difficulty": 3,
                    "tags": ["听力理解"],
                })

    return questions


def _parse_cet_reading(md_text):
    """Parse CET reading comprehension choice questions."""
    questions = []

    # Find Section C (careful reading with choices)
    sectc_match = re.search(
        r"(Section\s*C|仔细阅读).*?(?=Part\s*IV|Translation|翻译|$)",
        md_text, re.DOTALL | re.IGNORECASE,
    )
    if not sectc_match:
        return []

    sectc_text = sectc_match.group(0)

    q_pattern = re.compile(r"^(\d{2})\.\s", re.MULTILINE)
    q_positions = [(m.start(), int(m.group(1))) for m in q_pattern.finditer(sectc_text)]

    for i, (pos, qnum) in enumerate(q_positions):
        if qnum < 36 or qnum > 60:
            continue

        block = sectc_text[pos:q_positions[i + 1][0]] if i + 1 < len(q_positions) else sectc_text[pos:]

        first_opt = re.search(r"([A-D])\)\s", block)
        if not first_opt:
            continue
        stem = block[: first_opt.start()].strip()
        stem = re.sub(r"\s+", " ", stem).strip()
        stem = re.sub(r"^\d{2}\.\s*", "", stem)

        opts = {}
        opt_pattern = re.compile(r"([A-D])\)\s*(.+?)(?=\s*[A-D]\)\s|\s*$)", re.DOTALL)
        for om in opt_pattern.finditer(block):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(" ,;，。；")
            text = re.sub(r"\s+", " ", text).strip()
            if text and letter not in opts:
                opts[letter] = text

        if len(opts) >= 4 and stem:
            opts = {k: opts[k] for k in "ABCD" if k in opts}
            if len(opts) == 4:
                questions.append({
                    "id": "",
                    "number": qnum,
                    "type": "choice",
                    "score": 14.2,
                    "content": stem,
                    "options": opts,
                    "answer": "A",
                    "solution": "阅读理解题，答案待核实，请以官方公布为准。",
                    "analysis": "仔细阅读，细节/推断/主旨题",
                    "knowledge_points": ["reading-comprehension"],
                    "difficulty": 3,
                    "tags": ["仔细阅读"],
                })

    return questions


# ─── Math2 local clone helpers ───

def _chinese_numeral_to_int(text):
    """Convert 4-char Chinese numeral year (e.g. '二〇一九') to int (2019)."""
    digit_map = {
        '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4',
        '五': '5', '六': '6', '七': '7', '八': '8', '九': '9',
    }
    result = ""
    for ch in text:
        if ch in digit_map:
            result += digit_map[ch]
        elif ch.isdigit():
            result += ch
    if result and len(result) == 4:
        try:
            return int(result)
        except ValueError:
            return None
    return None


def _split_combined_by_years(md_text):
    """Split combined markdown by year headers. Returns list of (year_str, section_md)."""
    year_pattern = re.compile(
        r"^#\s*([一二三四五六七八九〇零]{4})年考研数学",
        re.MULTILINE,
    )
    matches = list(year_pattern.finditer(md_text))
    sections = []
    for i, m in enumerate(matches):
        year = _chinese_numeral_to_int(m.group(1))
        if not year:
            continue
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(md_text)
        sections.append((str(year), md_text[start:end]))
    return sections


def _clean_combined_section(section_md):
    """Remove solution lines ('解.') from combined file sections to isolate questions."""
    lines = section_md.split('\n')
    cleaned = []
    in_solution = False
    for line in lines:
        stripped = line.strip()
        if re.match(r'^解[\.．、：:]', stripped):
            in_solution = True
            continue
        if in_solution:
            if re.match(r'^[\(（]?\d+[\)）\.．、]', stripped) or re.match(r'^#{1,3}\s', stripped):
                in_solution = False
                cleaned.append(line)
            continue
        cleaned.append(line)
    return '\n'.join(cleaned)


def _update_answers_from_solutions(questions, section_md):
    """Update choice question answers from '解. 应选 (X).' format."""
    for q in questions:
        if q["type"] != "choice":
            continue
        qnum = q["number"]
        pattern = rf"(?:^|\n)\s*[\(（]?{qnum}[\)）\.．、].*?解[\.．、：:]\s*应选\s*[\(（]?([A-D])[\)）\.]?"
        m = re.search(pattern, section_md, re.DOTALL)
        if m:
            q["answer"] = m.group(1).upper()


# ─── Generation functions ───

def gen_math(owner_repo, subject_name, subject_code, subject_label, output_file):
    """Generate math1-exams.json or math2-exams.json."""
    print(f"\n=== Generating {output_file} ({owner_repo}) ===")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # Determine the Chinese numeral for the subject
    if subject_code == "math1":
        cn_num = "一"
    else:
        cn_num = "二"

    branch = "main"

    # Construct candidate filenames for years 2000-2025 (no API needed)
    # Known patterns: "YYYY年考研数学(一)真题.md" and "YYYY年数学一真题.md"
    candidate_files = []
    for year in range(2000, 2026):
        year_str = str(year)
        candidate_files.append((year_str, f"papers/{year_str}年考研数学({cn_num})真题.md"))
        candidate_files.append((year_str, f"papers/{year_str}年数学{cn_num}真题.md"))
        # Additional pattern without parentheses
        candidate_files.append((year_str, f"papers/{year_str}年考研数学{cn_num}真题.md"))

    papers = []
    seen_years = set()

    for year, filepath in candidate_files:
        if year in seen_years:
            continue

        cache_name = f"{subject_code}-{year}.md"
        cache_path = CACHE_DIR / subject_code / cache_name

        print(f"  Trying {subject_label} {year}: {Path(filepath).name}...")
        md = download_raw(owner_repo, branch, filepath, cache_path)
        if not md:
            continue

        questions = parse_math_paper(md, year, subject_label, subject_code)
        if len(questions) < 5:
            print(f"  WARNING: {subject_label} {year} only has {len(questions)} questions, skipping")
            continue

        seen_years.add(year)
        papers.append({
            "id": f"{subject_code}-{year}",
            "year": year,
            "subject": subject_label,
            "category": subject_code,
            "paper_name": f"{year}年考研{subject_label}真题",
            "questions": questions,
        })
        print(f"  {subject_label} {year}: {len(questions)} questions")

    # Fallback: If not enough papers and this is math2, try local clone
    if len(papers) < 5 and subject_code == "math2":
        local_clone = CACHE_DIR / "repos" / "Kaoyan-Math2-Papers" / "solutions"
        if local_clone.exists():
            print(f"  Trying local clone at {local_clone}...")
            # Individual year files (2020-2024) with standard format
            local_files = [
                ("2020", local_clone / "2020" / "math2_2020" / "math2_2020.md"),
                ("2021", local_clone / "2021" / "math2_2021" / "math2_2021.md"),
                ("2022", local_clone / "2022" / "math2_2022" / "math2_2022.md"),
                ("2023", local_clone / "2023" / "math2_2023" / "math2_2023.md"),
                ("2024", local_clone / "2024" / "math2_2024.md"),
            ]
            for year, md_path in local_files:
                if year in seen_years:
                    continue
                if not md_path.exists():
                    print(f"  Local file not found: {md_path.name}")
                    continue
                md = md_path.read_text(encoding="utf-8")
                questions = parse_math_paper(md, year, subject_label, subject_code)
                if len(questions) < 5:
                    print(f"  WARNING: {subject_label} {year} only has {len(questions)} questions, skipping")
                    continue
                seen_years.add(year)
                papers.append({
                    "id": f"{subject_code}-{year}",
                    "year": year,
                    "subject": subject_label,
                    "category": subject_code,
                    "paper_name": f"{year}年考研{subject_label}真题",
                    "questions": questions,
                })
                print(f"  {subject_label} {year} (local): {len(questions)} questions")

            # Also try parsing combined 1987-2019 file for more recent years
            combined_path = local_clone / "math2_1987-2019" / "math2_1987-2019.md"
            if combined_path.exists():
                print(f"  Parsing combined 1987-2019 file for additional years...")
                combined_md = combined_path.read_text(encoding="utf-8")
                year_sections = _split_combined_by_years(combined_md)
                for year, section_md in year_sections:
                    if year in seen_years:
                        continue
                    yr = int(year)
                    if yr < 2010:
                        continue
                    # Clean solution lines to isolate questions
                    cleaned_md = _clean_combined_section(section_md)
                    questions = parse_math_paper(cleaned_md, year, subject_label, subject_code)
                    if len(questions) < 5:
                        continue
                    # Update answers from original section (has '解. 应选 (X).' patterns)
                    _update_answers_from_solutions(questions, section_md)
                    seen_years.add(year)
                    papers.append({
                        "id": f"{subject_code}-{year}",
                        "year": year,
                        "subject": subject_label,
                        "category": subject_code,
                        "paper_name": f"{year}年考研{subject_label}真题",
                        "questions": questions,
                    })
                    print(f"  {subject_label} {year} (combined): {len(questions)} questions")
                    if len(papers) >= 15:
                        break
        else:
            print(f"  Local clone not found at {local_clone}")

    # Sort by year
    papers.sort(key=lambda p: p["year"])

    output = {
        "subject": f"考研{subject_label}",
        "subject_code": subject_code,
        "version": "1.0.0",
        "last_updated": "2026-07-10",
        "description": f"考研{subject_label}历年真题",
        "notice": "题目来源于公开的 GitHub 开源仓库，答案仅供参考，请以官方公布为准",
        "papers": papers,
    }

    out_path = OUTPUT_DIR / output_file
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  Written: {out_path} ({len(papers)} papers)")
    return output


def gen_english1_2():
    """Generate english1-2-exams.json from Fantasia1999/kaoyanzhenti."""
    print("\n=== Generating english1-2-exams.json ===")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    branch = "main"

    # Try to get file tree from API (single call)
    tree = get_repo_tree(ENG_REPO, "main")
    if tree:
        md_files = list_md_files_in_tree(tree)
    else:
        md_files = []

    # Filter for English1 and English2 files
    if md_files:
        eng1_files = [f for f in md_files if "英语一" in f and "英语真题" in f]
        eng2_files = [f for f in md_files if "英语二" in f and "英语真题" in f]
        print(f"  Found {len(eng1_files)} English1 files, {len(eng2_files)} English2 files (via API)")
    else:
        # Fallback: construct URLs based on known structure
        # Structure: 公共课/英语真题/英语一/YEAR.md and 公共课/英语真题/英语二/YEAR.md
        print("  API unavailable, constructing URLs based on known structure...")
        eng1_files = []
        eng2_files = []
        for year in range(2010, 2024):
            for ext in [".md", ".markdown", ".pdf.md"]:
                eng1_files.append(f"公共课/英语真题/英语一/{year}{ext}")
                if year >= 2010:
                    eng2_files.append(f"公共课/英语真题/英语二/{year}{ext}")

    papers = []

    # Parse English1
    for filepath in sorted(eng1_files):
        year_match = re.search(r"(20\d{2}|19\d{2})", filepath)
        if not year_match:
            continue
        year = year_match.group(1)
        if int(year) < 2010:
            continue

        cache_path = CACHE_DIR / "english1_2" / f"eng1-{year}.md"
        print(f"  Downloading English1 {year}...")
        md = download_raw(ENG_REPO, branch, filepath, cache_path)
        if not md:
            continue

        questions = parse_english_paper(md, year, "英语一", "english1")
        if len(questions) < 3:
            print(f"  WARNING: English1 {year} only has {len(questions)} questions, skipping")
            continue

        papers.append({
            "id": f"english1-{year}",
            "year": year,
            "subject": "英语一",
            "category": "english1",
            "paper_name": f"{year}年考研英语一真题",
            "questions": questions,
        })
        print(f"  English1 {year}: {len(questions)} questions")

    # Parse English2
    for filepath in sorted(eng2_files):
        year_match = re.search(r"(20\d{2})", filepath)
        if not year_match:
            continue
        year = year_match.group(1)
        if int(year) < 2010:
            continue

        cache_path = CACHE_DIR / "english1_2" / f"eng2-{year}.md"
        print(f"  Downloading English2 {year}...")
        md = download_raw(ENG_REPO, branch, filepath, cache_path)
        if not md:
            continue

        questions = parse_english_paper(md, year, "英语二", "english2")
        if len(questions) < 3:
            print(f"  WARNING: English2 {year} only has {len(questions)} questions, skipping")
            continue

        papers.append({
            "id": f"english2-{year}",
            "year": year,
            "subject": "英语二",
            "category": "english2",
            "paper_name": f"{year}年考研英语二真题",
            "questions": questions,
        })
        print(f"  English2 {year}: {len(questions)} questions")

    # If no papers downloaded from Fantasia1999, fall back to existing cached files
    if len(papers) < 5:
        print("  WARNING: Not enough papers from Fantasia1999, trying cached files...")
        existing_cache = CACHE_DIR / "english1"
        if existing_cache.exists():
            for cache_file in sorted(existing_cache.glob("*.md")):
                year = cache_file.stem
                if not year.isdigit() or int(year) < 2010:
                    continue
                # Check if we already have this year for english1
                if any(p["id"] == f"english1-{year}" for p in papers):
                    continue
                md = cache_file.read_text(encoding="utf-8")
                questions = parse_english_paper(md, year, "英语一", "english1")
                if len(questions) >= 3:
                    papers.append({
                        "id": f"english1-{year}",
                        "year": year,
                        "subject": "英语一",
                        "category": "english1",
                        "paper_name": f"{year}年考研英语一真题",
                        "questions": questions,
                    })
                    print(f"  English1 {year} (cached): {len(questions)} questions")

    # Sort by year
    papers.sort(key=lambda p: (p["category"], p["year"]))

    output = {
        "subject": "考研英语一和英语二",
        "subject_code": "english1-2",
        "version": "1.0.0",
        "last_updated": "2026-07-10",
        "description": "考研英语一和英语二历年真题",
        "notice": "题目来源于公开的 GitHub 开源仓库，答案仅供参考，请以官方公布为准",
        "papers": papers,
    }

    out_path = OUTPUT_DIR / "english1-2-exams.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  Written: {out_path} ({len(papers)} papers)")
    return output


def gen_cet4_6():
    """Generate cet4-6-exams.json from DieDiDi/CET4-6-past-exam-paper."""
    print("\n=== Generating cet4-6-exams.json ===")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    branch = "main"

    # Try to get file tree from API (single call)
    tree = get_repo_tree(CET_REPO, "main")
    if tree:
        md_files = list_md_files_in_tree(tree)
    else:
        md_files = []

    if md_files:
        # Categorize files by CET4/CET6
        cet4_files = [f for f in md_files if "cet4" in f.lower() or "四级" in f or "CET4" in f]
        cet6_files = [f for f in md_files if "cet6" in f.lower() or "六级" in f or "CET6" in f]
        print(f"  Found {len(cet4_files)} CET4 files, {len(cet6_files)} CET6 files (via API)")
    else:
        # Fallback: construct URLs based on common patterns
        print("  API unavailable, constructing URLs based on common patterns...")
        cet4_files = []
        cet6_files = []
        for year in [2023]:
            for month in ["06", "12"]:
                for n in [1, 2, 3]:
                    cet4_files.append(f"CET4/{year}.{month}/cet4-{year}-{month}-{n}.md")
                    cet6_files.append(f"CET6/{year}.{month}/cet6-{year}-{month}-{n}.md")
        # Also try 四六级级真题 directory
        for year in [2023]:
            for month in ["06", "12"]:
                for n in [1, 2, 3]:
                    cet4_files.append(f"四六级级真题/CET4/{year}.{month}/cet4-{year}-{month}-{n}.md")
                    cet6_files.append(f"四六级级真题/CET6/{year}.{month}/cet6-{year}-{month}-{n}.md")

    papers = []

    # Parse CET4
    for filepath in sorted(cet4_files):
        year_match = re.search(r"(20\d{2})", filepath)
        if not year_match:
            continue
        year = year_match.group(1)
        month_match = re.search(r"(?:20\d{2}[.\-_/])?(\d{2})", filepath)
        month = month_match.group(1) if month_match else "06"
        set_match = re.search(r"[ _-](\d)[^.]*$", filepath)
        set_n = int(set_match.group(1)) if set_match else 1

        cache_path = CACHE_DIR / "cet4_6" / f"cet4-{year}-{month}-{set_n}.md"
        print(f"  Downloading CET4 {year}.{month} set {set_n}...")
        md = download_raw(CET_REPO, branch, filepath, cache_path)
        if not md:
            continue

        questions = parse_cet_paper(md, year, month, set_n, "CET4", "cet4")
        if len(questions) < 3:
            print(f"  WARNING: CET4 {year}.{month} set {set_n} only has {len(questions)} questions, skipping")
            continue

        papers.append({
            "id": f"cet4-{year}-{month}-{set_n}",
            "year": year,
            "subject": "CET4",
            "category": "cet4",
            "paper_name": f"{year}年{int(month)}月英语四级真题（第{set_n}套）",
            "questions": questions,
        })
        print(f"  CET4 {year}.{month} set {set_n}: {len(questions)} questions")

    # Parse CET6
    for filepath in sorted(cet6_files):
        year_match = re.search(r"(20\d{2})", filepath)
        if not year_match:
            continue
        year = year_match.group(1)
        month_match = re.search(r"(?:20\d{2}[.\-_/])?(\d{2})", filepath)
        month = month_match.group(1) if month_match else "06"
        set_match = re.search(r"[ _-](\d)[^.]*$", filepath)
        set_n = int(set_match.group(1)) if set_match else 1

        cache_path = CACHE_DIR / "cet4_6" / f"cet6-{year}-{month}-{set_n}.md"
        print(f"  Downloading CET6 {year}.{month} set {set_n}...")
        md = download_raw(CET_REPO, branch, filepath, cache_path)
        if not md:
            continue

        questions = parse_cet_paper(md, year, month, set_n, "CET6", "cet6")
        if len(questions) < 3:
            print(f"  WARNING: CET6 {year}.{month} set {set_n} only has {len(questions)} questions, skipping")
            continue

        papers.append({
            "id": f"cet6-{year}-{month}-{set_n}",
            "year": year,
            "subject": "CET6",
            "category": "cet6",
            "paper_name": f"{year}年{int(month)}月英语六级真题（第{set_n}套）",
            "questions": questions,
        })
        print(f"  CET6 {year}.{month} set {set_n}: {len(questions)} questions")

    # If not enough papers from DieDiDi, fall back to existing cached files
    if len(papers) < 5:
        print("  WARNING: Not enough papers from DieDiDi, trying cached CET files...")
        # Try existing CET4 cache
        cet4_cache = CACHE_DIR / "CET4"
        if cet4_cache.exists():
            for ym_dir in sorted(cet4_cache.iterdir()):
                if not ym_dir.is_dir():
                    continue
                ym = ym_dir.name  # e.g., "2023.06"
                parts = ym.split(".")
                if len(parts) != 2:
                    continue
                year, month = parts[0], parts[1]
                for md_file in sorted(ym_dir.glob("*.md")):
                    set_match = re.search(r"-(\d)\.md$", md_file.name)
                    set_n = int(set_match.group(1)) if set_match else 1
                    paper_id = f"cet4-{year}-{month}-{set_n}"
                    if any(p["id"] == paper_id for p in papers):
                        continue
                    md = md_file.read_text(encoding="utf-8")
                    questions = parse_cet_paper(md, year, month, set_n, "CET4", "cet4")
                    if len(questions) >= 3:
                        papers.append({
                            "id": paper_id,
                            "year": year,
                            "subject": "CET4",
                            "category": "cet4",
                            "paper_name": f"{year}年{int(month)}月英语四级真题（第{set_n}套）",
                            "questions": questions,
                        })
                        print(f"  CET4 {year}.{month} set {set_n} (cached): {len(questions)} questions")

        # Try existing CET6 cache
        cet6_cache = CACHE_DIR / "CET6"
        if cet6_cache.exists():
            for ym_dir in sorted(cet6_cache.iterdir()):
                if not ym_dir.is_dir():
                    continue
                ym = ym_dir.name
                parts = ym.split(".")
                if len(parts) != 2:
                    continue
                year, month = parts[0], parts[1]
                for md_file in sorted(ym_dir.glob("*.md")):
                    set_match = re.search(r"-(\d)\.md$", md_file.name)
                    set_n = int(set_match.group(1)) if set_match else 1
                    paper_id = f"cet6-{year}-{month}-{set_n}"
                    if any(p["id"] == paper_id for p in papers):
                        continue
                    md = md_file.read_text(encoding="utf-8")
                    questions = parse_cet_paper(md, year, month, set_n, "CET6", "cet6")
                    if len(questions) >= 3:
                        papers.append({
                            "id": paper_id,
                            "year": year,
                            "subject": "CET6",
                            "category": "cet6",
                            "paper_name": f"{year}年{int(month)}月英语六级真题（第{set_n}套）",
                            "questions": questions,
                        })
                        print(f"  CET6 {year}.{month} set {set_n} (cached): {len(questions)} questions")

    # Sort by category then year
    papers.sort(key=lambda p: (p["category"], p["year"]))

    output = {
        "subject": "英语四六级",
        "subject_code": "cet4-6",
        "version": "1.0.0",
        "last_updated": "2026-07-10",
        "description": "大学英语四六级历年真题",
        "notice": "题目来源于公开的 GitHub 开源仓库，答案仅供参考，请以官方公布为准",
        "papers": papers,
    }

    out_path = OUTPUT_DIR / "cet4-6-exams.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  Written: {out_path} ({len(papers)} papers)")
    return output


# ─── Validation ───

def validate_json(filepath):
    """Validate a JSON file can be parsed and has required fields."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        papers = data.get("papers", [])
        n_papers = len(papers)
        total_qs = sum(len(p.get("questions", [])) for p in papers)

        # Check required fields
        required = ["subject", "subject_code", "version", "notice", "papers"]
        for field in required:
            if field not in data:
                print(f"  ERROR: Missing field '{field}' in {filepath.name}")

        # Check each paper has questions
        for p in papers:
            if len(p.get("questions", [])) < 5:
                print(f"  WARNING: Paper {p.get('id')} has only {len(p.get('questions', []))} questions")

        print(f"  {filepath.name}: {n_papers} papers, {total_qs} questions")
        return True
    except json.JSONDecodeError as e:
        print(f"  ERROR: Invalid JSON in {filepath.name}: {e}")
        return False
    except Exception as e:
        print(f"  ERROR: {filepath.name}: {e}")
        return False


# ─── Main ───

def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    results = {}

    # 1. Math1
    try:
        results["math1"] = gen_math(
            MATH1_REPO, "考研数学一", "math1", "数学一", "math1-exams.json"
        )
    except Exception as e:
        print(f"  ERROR generating math1: {e}")
        results["math1"] = None

    # 2. Math2
    try:
        results["math2"] = gen_math(
            MATH2_REPO, "考研数学二", "math2", "数学二", "math2-exams.json"
        )
    except Exception as e:
        print(f"  ERROR generating math2: {e}")
        results["math2"] = None

    # 3. English1-2
    try:
        results["english1-2"] = gen_english1_2()
    except Exception as e:
        print(f"  ERROR generating english1-2: {e}")
        results["english1-2"] = None

    # 4. CET4-6
    try:
        results["cet4-6"] = gen_cet4_6()
    except Exception as e:
        print(f"  ERROR generating cet4-6: {e}")
        results["cet4-6"] = None

    # Summary
    print("\n=== Summary ===")
    for name, data in results.items():
        if data:
            n_papers = len(data["papers"])
            n_questions = sum(len(p["questions"]) for p in data["papers"])
            print(f"  {name}: {n_papers} papers, {n_questions} questions")
        else:
            print(f"  {name}: FAILED")

    # Validation
    print("\n=== Validation ===")
    for fname in ["math1-exams.json", "math2-exams.json", "english1-2-exams.json", "cet4-6-exams.json"]:
        fpath = OUTPUT_DIR / fname
        if fpath.exists():
            validate_json(fpath)
        else:
            print(f"  {fname}: FILE NOT FOUND")

    close_client()


if __name__ == "__main__":
    main()
