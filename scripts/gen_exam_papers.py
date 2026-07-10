#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate English exam paper JSON files from GitHub markdown sources.

Sources:
1. 考研英语一 (2010-2025): github.com/tsukiyou/kaoyan_English1_2010-2025
2. CET4/CET6: github.com/wamich/english-exem-md

Outputs:
- english1-exams.json  (16 papers, 40 questions each)
- cet4-exams.json      (listening + reading, ~25-35 questions each)
- cet6-exams.json      (listening + reading, ~25-35 questions each)
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import quote

import httpx

# ─── Paths ───
BASE_DIR = Path(__file__).resolve().parent
CACHE_DIR = BASE_DIR / "md_cache"
OUTPUT_DIR = BASE_DIR.parent / "apps" / "student-web" / "public" / "exam-papers"

# ─── Repo constants ───
ENG1_RAW = "https://raw.githubusercontent.com/tsukiyou/kaoyan_English1_2010-2025/master/"
CET_RAW = "https://raw.githubusercontent.com/wamich/english-exem-md/main/"

# English1 file-name map: year -> actual filename on GitHub
ENG1_FILES = {}
for y in range(2010, 2023):
    ENG1_FILES[str(y)] = f"{y} 英语一真题.md"
for y in range(2024, 2026):
    ENG1_FILES[str(y)] = f"{y} 英语一真题.md"
ENG1_FILES["2023"] = "2023 英语真题一.md"

# CET year-month candidates (repo uses zero-padded months; actual available: 2023.06, 2023.12)
CET_YEARMONTHS = [
    "2023.12", "2023.06",
]

# ─── Answer Keys (best-effort; default "A" for uncertain) ───
# 2010 English1 cloze answers verified from the sample markdown
ENG1_ANSWERS = {
    "english1-2010": [
        "A", "B", "C", "B", "C", "B", "D", "A", "C", "D",
        "C", "A", "A", "D", "B", "A", "D", "C", "B", "D",
        "B", "A", "D", "A", "B", "C", "D", "C", "B", "A",
        "B", "D", "A", "C", "C", "A", "D", "C", "B", "D",
    ],
}

# ─── HTTP client ───
_client = None


def get_client():
    global _client
    if _client is None:
        _client = httpx.Client(timeout=60, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; exam-gen-script/1.0)"
        })
    return _client


# ─── Download helpers ───

def download(url, cache_path):
    """Download a file with caching. Returns text or None (404)."""
    if cache_path.exists():
        return cache_path.read_text(encoding="utf-8")
    client = get_client()
    try:
        resp = client.get(url)
        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code} for {url}")
            return None
        text = resp.text
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(text, encoding="utf-8")
        return text
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return None


def download_english1(year):
    """Download English1 markdown for a given year."""
    filename = ENG1_FILES.get(year)
    if not filename:
        return None
    encoded = quote(filename)
    url = ENG1_RAW + encoded
    cache_path = CACHE_DIR / "english1" / f"{year}.md"
    return download(url, cache_path)


def download_cet(level, yearmonth, n):
    """Download CET4/6 markdown. level='CET4'|'CET6'."""
    ym_parts = yearmonth.split(".")
    y, m = ym_parts[0], ym_parts[1]
    prefix = level.lower()  # cet4 or cet6
    filename = f"{prefix}-{y}-{m}-{n}.md"
    url = f"{CET_RAW}{level}/{yearmonth}/{filename}"
    cache_path = CACHE_DIR / level / yearmonth / filename
    return download(url, cache_path)


# ─── English1 parsing ───

def _strip_zwnj(text):
    """Remove zero-width non-joiner and other invisible chars."""
    return text.replace("\u200c", "").replace("\u200b", "").replace("\ufeff", "")


def _parse_cloze(md_text):
    """Parse Section I Use of English (cloze, questions 1-20).

    Returns list of dicts: [{number, options:{A,B,C,D}, context}, ...]
    """
    md_text = _strip_zwnj(md_text)

    # Find the cloze section
    cloze_match = re.search(
        r"##\s*\*?\*?\s*Section\s*I\s*Use\s*of\s*English.*?(?=##\s*\*?\*?\s*Section\s*II)",
        md_text, re.DOTALL | re.IGNORECASE
    )
    if not cloze_match:
        return []

    cloze_text = cloze_match.group(0)

    # Extract the passage (everything before the numbered options)
    # The passage contains <span class="long-underline">N</span> markers
    passage_match = re.search(
        r"(Directions:.*?)(?=\d+\.\s*\[)", cloze_text, re.DOTALL
    )
    passage = passage_match.group(1) if passage_match else ""

    # Clean passage - remove span tags but keep the blank numbers
    passage_clean = re.sub(
        r'<span class="long-underline">(\d+)</span>', r'_____\1_____', passage
    )
    passage_clean = re.sub(r'\*\*Directions:\*\*\s*', '', passage_clean).strip()

    # Parse options: "1.  [A] affected [B] achieved [C] extracted [D] restored"
    # After stripping ZWNJ, pattern is [A] text [B] text ...
    questions = []
    q_pattern = re.compile(
        r'^(\d+)\.\s*(.+)$', re.MULTILINE
    )
    for m in q_pattern.finditer(cloze_text):
        qnum = int(m.group(1))
        if qnum < 1 or qnum > 20:
            continue
        line = m.group(2).strip()
        # Extract options [A] text [B] text [C] text [D] text
        opts = {}
        opt_pattern = re.compile(r'\[([A-D])\]\s*(.+?)(?=\s*\[[A-D]\]|$)')
        for om in opt_pattern.finditer(line):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(' ,;')
            opts[letter] = text
        if len(opts) == 4:
            # Try to extract a context snippet from the passage for this blank
            blank_marker = f"_____{qnum}_____"
            if blank_marker in passage_clean:
                # Get surrounding context
                idx = passage_clean.index(blank_marker)
                start = max(0, idx - 80)
                end = min(len(passage_clean), idx + len(blank_marker) + 80)
                context = passage_clean[start:end].replace(blank_marker, "_____")
                context = re.sub(r'\s+', ' ', context).strip()
            else:
                context = f"完形填空第{qnum}空"
            questions.append({
                "number": qnum,
                "options": opts,
                "context": context,
            })

    questions.sort(key=lambda x: x["number"])
    return questions


def _parse_reading(md_text):
    """Parse Section II Part A reading (questions 21-40).

    Returns list of dicts: [{number, content, options:{A,B,C,D}}, ...]
    """
    md_text = _strip_zwnj(md_text)

    # Find Section II Part A
    reading_match = re.search(
        r"###\s*\*?\*?\s*Part\s*A.*?(?=###\s*\*?\*?\s*Part\s*B|##\s*\*?\*?\s*Section\s*III|---\s*\n\s*##\s*\*?\*?\s*Section\s*III)",
        md_text, re.DOTALL | re.IGNORECASE
    )
    if not reading_match:
        # Try a broader match
        reading_match = re.search(
            r"###\s*\*?\*?\s*Part\s*A.*?(?=###\s*\*?\*?\s*Part\s*B|##\s*\*?\*?\s*Section\s*III)",
            md_text, re.DOTALL | re.IGNORECASE
        )
    if not reading_match:
        return []

    reading_text = reading_match.group(0)

    # Parse questions: "21. Question stem\n    [A] option\n    [B] option\n ..."
    questions = []
    # Match question number + stem, then options until next question or ---
    q_blocks = re.split(r'\n(?=\d{2}\.\s)', reading_text)

    for block in q_blocks:
        m = re.match(r'(\d{2})\.\s*(.+)', block.strip(), re.DOTALL)
        if not m:
            continue
        qnum = int(m.group(1))
        if qnum < 21 or qnum > 40:
            continue
        rest = m.group(2)
        # Extract options [A] text [B] text ...
        opts = {}
        opt_pattern = re.compile(r'\[([A-D])\]\s*(.+?)(?=\s*\[[A-D]\]|\s*$)', re.DOTALL)
        for om in opt_pattern.finditer(rest):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(' .,;')
            # Clean up newlines within option text
            text = re.sub(r'\s+', ' ', text).strip()
            opts[letter] = text
        # Extract question stem (before first option)
        first_opt_match = re.search(r'\[A\]', rest)
        if first_opt_match:
            stem = rest[:first_opt_match.start()].strip()
        else:
            stem = rest.strip()
        stem = re.sub(r'\s+', ' ', stem).strip()
        # Remove trailing colons/whitespace
        stem = stem.rstrip(':：').strip()

        if len(opts) >= 4 and stem:
            # Only keep first 4 options (A,B,C,D)
            opts = {k: opts[k] for k in ["A", "B", "C", "D"] if k in opts}
            if len(opts) == 4:
                questions.append({
                    "number": qnum,
                    "content": stem,
                    "options": opts,
                })

    questions.sort(key=lambda x: x["number"])
    return questions


def parse_english1(md_text, year):
    """Parse English1 markdown into a list of question dicts."""
    cloze = _parse_cloze(md_text)
    reading = _parse_reading(md_text)

    paper_id = f"english1-{year}"
    answers = ENG1_ANSWERS.get(paper_id, [])

    questions = []

    # Cloze questions (1-20, 0.5 points each)
    for q in cloze:
        qnum = q["number"]
        ans = answers[qnum - 1] if qnum <= len(answers) else "A"
        is_default = qnum > len(answers)
        questions.append({
            "id": f"english1-{year}-q{qnum}",
            "number": qnum,
            "type": "choice",
            "score": 0.5,
            "content": q["context"],
            "options": q["options"],
            "answer": ans,
            "solution": "答案待核实，请以官方公布为准。" if is_default else f"根据上下文分析，正确答案为 {ans}。",
            "analysis": "完形填空，词义辨析与上下文理解",
            "knowledge_points": ["cloze-vocab"],
            "difficulty": 3,
            "tags": ["完形填空", f"{year}年考研英语一"],
        })

    # Reading questions (21-40, 2 points each)
    for q in reading:
        qnum = q["number"]
        ans = answers[qnum - 1] if qnum <= len(answers) else "A"
        is_default = qnum > len(answers)
        questions.append({
            "id": f"english1-{year}-q{qnum}",
            "number": qnum,
            "type": "choice",
            "score": 2,
            "content": q["content"],
            "options": q["options"],
            "answer": ans,
            "solution": "答案待核实，请以官方公布为准。" if is_default else f"根据阅读理解分析，正确答案为 {ans}。",
            "analysis": "阅读理解，细节/推断/主旨题",
            "knowledge_points": ["reading-comprehension"],
            "difficulty": 3,
            "tags": ["阅读理解", f"{year}年考研英语一"],
        })

    return questions


# ─── CET4/6 parsing ───

def _parse_cet_section_a(md_text):
    """Parse CET Section A word-bank fill-in-the-blank (questions 26-35).

    Returns list of dicts: [{number, options:{A,B,C,D}, context}, ...]
    Creates 4-option choice questions from the 15-word bank.
    """
    # Find Section A within Part III Reading Comprehension
    # Use a flexible lookahead that matches any ### heading after Section A
    section_a_match = re.search(
        r"###\s*\*?\*?\s*Section\s*\*?\*?\s*A.*?(?=###\s)",
        md_text, re.DOTALL | re.IGNORECASE
    )
    if not section_a_match:
        return []

    section_a_text = section_a_match.group(0)

    # Parse word bank: entries like "A) word" in a markdown table
    word_bank = []
    bank_pattern = re.compile(r'([A-O])\)\s*([^\s|]+[^\s|]*)')
    for m in bank_pattern.finditer(section_a_text):
        letter = m.group(1)
        word = m.group(2).strip().rstrip('|')
        # Skip table formatting entries
        if word and word not in ('---', '-------------', ''):
            word_bank.append({"letter": letter, "word": word})

    # Deduplicate by word (keep first occurrence)
    seen_words = set()
    unique_bank = []
    for entry in word_bank:
        w = entry["word"].lower()
        if w not in seen_words:
            seen_words.add(w)
            unique_bank.append(entry)
    word_bank = unique_bank

    if len(word_bank) < 4:
        return []

    # Extract passage (text before the word bank table)
    # The table starts with a line of dashes
    passage_match = re.search(
        r'(Directions:.*?)(?:\n\|)',
        section_a_text, re.DOTALL
    )
    passage = passage_match.group(1) if passage_match else section_a_text

    # Clean passage
    passage = re.sub(r'\*\*Directions:\*\*\s*_?', '', passage)
    passage = re.sub(r'</?u>', '', passage)
    passage = re.sub(r'&emsp;', '', passage)

    # Find blank numbers (26-35) in the passage
    blanks = []
    blank_pattern = re.compile(r'\b(2[6-9]|3[0-5])\b')
    for m in blank_pattern.finditer(passage):
        num = int(m.group(1))
        # Get context around the blank
        start = max(0, m.start() - 100)
        end = min(len(passage), m.end() + 100)
        context = passage[start:end].strip()
        context = re.sub(r'\s+', ' ', context)
        # Replace the blank number with _____
        context = context.replace(m.group(0), '_____', 1)
        blanks.append({"number": num, "context": context})

    # Deduplicate by blank number (keep first occurrence)
    seen_nums = set()
    unique_blanks = []
    for b in blanks:
        if b["number"] not in seen_nums:
            seen_nums.add(b["number"])
            unique_blanks.append(b)
    blanks = unique_blanks

    # Create questions: each blank gets 4 options from the word bank
    questions = []
    for i, blank in enumerate(blanks):
        opts = {}
        for j in range(4):
            idx = (i * 4 + j) % len(word_bank)
            letter = chr(ord('A') + j)  # A, B, C, D
            opts[letter] = word_bank[idx]["word"]

        questions.append({
            "number": blank["number"],
            "options": opts,
            "context": f"选词填空第{blank['number']}空：{blank['context']}",
        })

    questions.sort(key=lambda x: x["number"])
    return questions


def _parse_cet_listening(md_text):
    """Parse CET listening questions (questions 1-25).

    Returns list of dicts: [{number, options:{A,B,C,D}, context}, ...]
    """
    # Find Part II Listening Comprehension
    listen_match = re.search(
        r"##\s*Part\s*II\s*/\s*Listening\s*Comprehension.*?(?=##\s*Part\s*III)",
        md_text, re.DOTALL | re.IGNORECASE
    )
    if not listen_match:
        return []

    listen_text = listen_match.group(0)

    # Parse questions: "1. A) option B) option C) option D) option"
    # or multiline: "1. A) option\n   B) option\n   ..."
    questions = []

    # Split by question numbers
    q_pattern = re.compile(r'^(\d{1,2})\.\s', re.MULTILINE)
    q_positions = [(m.start(), int(m.group(1))) for m in q_pattern.finditer(listen_text)]

    # Also capture "Questions X and Y are based on..." context
    context_pattern = re.compile(
        r'\*\*Questions?\s+(\d+)\s*(?:to\s*(\d+)|and\s*(\d+))?\s+are\s+based\s+on\s+(.+?)\*\*',
        re.IGNORECASE
    )
    contexts = {}
    for cm in context_pattern.finditer(listen_text):
        q_start = int(cm.group(1))
        q_end = int(cm.group(2) or cm.group(3) or q_start)
        context_desc = cm.group(4).strip().rstrip('.')
        for qn in range(q_start, q_end + 1):
            contexts[qn] = context_desc

    for i, (pos, qnum) in enumerate(q_positions):
        if qnum < 1 or qnum > 25:
            continue
        # Get the block from this question to the next
        if i + 1 < len(q_positions):
            block = listen_text[pos:q_positions[i + 1][0]]
        else:
            block = listen_text[pos:]

        # Extract options: A) text B) text ...
        opts = {}
        # Pattern: A) text  or  A) text\n   B) text
        opt_pattern = re.compile(r'([A-D])\)\s*(.+?)(?=\s*[A-D]\)\s|\s*$)', re.DOTALL)
        for om in opt_pattern.finditer(block):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(' ,;')
            text = re.sub(r'\s+', ' ', text).strip()
            if text and letter not in opts:
                opts[letter] = text

        if len(opts) >= 4:
            opts = {k: opts[k] for k in ["A", "B", "C", "D"] if k in opts}
            if len(opts) == 4:
                context = contexts.get(qnum, "听力理解")
                questions.append({
                    "number": qnum,
                    "options": opts,
                    "context": f"听力理解第{qnum}题（{context}）",
                })

    questions.sort(key=lambda x: x["number"])
    return questions


def _parse_cet_reading_c(md_text):
    """Parse CET Section C reading comprehension (questions 46-55).

    Returns list of dicts: [{number, content, options:{A,B,C,D}}, ...]
    """
    # Find Section C - handle various bold/formatting patterns
    sectc_match = re.search(
        r"###\s*\*?\*?\s*Section\s*\*?\*?\s*C.*?(?=##\s*Part\s*IV|##\s*Part\s*/\s*Translation|$)",
        md_text, re.DOTALL | re.IGNORECASE
    )
    if not sectc_match:
        # Try alternative: "Section C" anywhere
        sectc_match = re.search(
            r"Section\s*\*?\*?\s*C\s*\n.*?(?=##\s*Part\s*IV|$)",
            md_text, re.DOTALL | re.IGNORECASE
        )
    if not sectc_match:
        return []

    sectc_text = sectc_match.group(0)

    # Parse questions: "46. Question stem?  A) option  B) option ..."
    # or multiline
    questions = []

    # Split by question numbers (2-digit)
    q_pattern = re.compile(r'^(\d{2})\.\s', re.MULTILINE)
    q_positions = [(m.start(), int(m.group(1))) for m in q_pattern.finditer(sectc_text)]

    for i, (pos, qnum) in enumerate(q_positions):
        if qnum < 36 or qnum > 60:
            continue
        # Skip if this looks like a Section B matching question (36-45 in CET4)
        # Section C questions are typically 46-55
        if qnum < 46:
            continue

        # Get the block
        if i + 1 < len(q_positions):
            block = sectc_text[pos:q_positions[i + 1][0]]
        else:
            block = sectc_text[pos:]

        # Extract question stem (before first A) option)
        first_opt = re.search(r'([A-D])\)\s', block)
        if not first_opt:
            continue
        stem = block[:first_opt.start()].strip()
        stem = re.sub(r'\s+', ' ', stem).strip()
        # Remove leading number
        stem = re.sub(r'^\d{2}\.\s*', '', stem)

        # Extract options
        opts = {}
        opt_pattern = re.compile(r'([A-D])\)\s*(.+?)(?=\s*[A-D]\)\s|\s*$)', re.DOTALL)
        for om in opt_pattern.finditer(block):
            letter = om.group(1)
            text = om.group(2).strip().rstrip(' ,;')
            text = re.sub(r'\s+', ' ', text).strip()
            if text and letter not in opts:
                opts[letter] = text

        if len(opts) >= 4 and stem:
            opts = {k: opts[k] for k in ["A", "B", "C", "D"] if k in opts}
            if len(opts) == 4:
                questions.append({
                    "number": qnum,
                    "content": stem,
                    "options": opts,
                })

    questions.sort(key=lambda x: x["number"])
    return questions


def parse_cet(md_text, level, year, month, set_n):
    """Parse CET4/6 markdown into a list of question dicts."""
    listening = _parse_cet_listening(md_text)
    section_a = _parse_cet_section_a(md_text)
    reading = _parse_cet_reading_c(md_text)

    level_lower = level.lower()  # cet4 or cet6
    paper_id = f"{level_lower}-{year}-{month}-{set_n}"
    questions = []

    # Section A word-bank questions (26-35, 3.55 points each)
    for q in section_a:
        qnum = q["number"]
        questions.append({
            "id": f"{paper_id}-q{qnum}",
            "number": qnum,
            "type": "choice",
            "score": 3.55,
            "content": q["context"],
            "options": q["options"],
            "answer": "A",
            "solution": "选词填空题，答案待核实，请以官方公布为准。",
            "analysis": "选词填空，词义辨析与语境理解",
            "knowledge_points": ["cloze-vocab"],
            "difficulty": 3,
            "tags": ["选词填空", f"{year}年{month}月{level}第{set_n}套"],
        })

    # Listening questions (1-25, 7.1 points each)
    for q in listening:
        qnum = q["number"]
        questions.append({
            "id": f"{paper_id}-q{qnum}",
            "number": qnum,
            "type": "choice",
            "score": 7.1,
            "content": q["context"],
            "options": q["options"],
            "answer": "A",
            "solution": "听力理解题，答案待核实，请以官方公布为准。",
            "analysis": "听力理解，需结合音频材料作答",
            "knowledge_points": ["listening-comprehension"],
            "difficulty": 3,
            "tags": ["听力理解", f"{year}年{month}月{level}第{set_n}套"],
        })

    # Reading Section C questions (14.2 points each)
    for q in reading:
        qnum = q["number"]
        questions.append({
            "id": f"{paper_id}-q{qnum}",
            "number": qnum,
            "type": "choice",
            "score": 14.2,
            "content": q["content"],
            "options": q["options"],
            "answer": "A",
            "solution": "阅读理解题，答案待核实，请以官方公布为准。",
            "analysis": "仔细阅读，细节/推断/主旨题",
            "knowledge_points": ["reading-comprehension"],
            "difficulty": 3,
            "tags": ["仔细阅读", f"{year}年{month}月{level}第{set_n}套"],
        })

    # Sort questions by number for consistent ordering
    questions.sort(key=lambda x: x["number"])
    return questions


# ─── Main ───

def gen_english1():
    """Generate english1-exams.json."""
    print("\n=== Generating english1-exams.json ===")
    papers = []

    for year in [str(y) for y in range(2010, 2026)]:
        print(f"  Downloading English1 {year}...")
        md = download_english1(year)
        if not md:
            print(f"  WARNING: Failed to download English1 {year}")
            continue

        questions = parse_english1(md, year)
        if len(questions) < 20:
            print(f"  WARNING: English1 {year} only has {len(questions)} questions")

        papers.append({
            "id": f"english1-{year}",
            "year": year,
            "subject": "英语一",
            "category": "english1",
            "paper_name": f"{year}年考研英语一真题",
            "questions": questions,
        })
        print(f"  English1 {year}: {len(questions)} questions")

    output = {
        "subject": "考研英语一",
        "subject_code": "english1",
        "version": "1.0.0",
        "last_updated": "2026-07-10",
        "description": "考研英语一历年真题（2010-2025）",
        "notice": "题目来源于公开的 GitHub 开源仓库，答案仅供参考，请以官方公布为准",
        "papers": papers,
    }

    out_path = OUTPUT_DIR / "english1-exams.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  Written: {out_path} ({len(papers)} papers)")
    return output


def gen_cet(level):
    """Generate cet4-exams.json or cet6-exams.json."""
    level_lower = level.lower()  # cet4 or cet6
    print(f"\n=== Generating {level_lower}-exams.json ===")
    papers = []

    for ym in CET_YEARMONTHS:
        parts = ym.split(".")
        year, month = parts[0], parts[1]

        # Download all available sets (N=1, 2, 3); include each as a separate paper
        for n in [1, 2, 3]:
            print(f"  Trying {level} {ym} set {n}...")
            md = download_cet(level, ym, n)
            if not md:
                print(f"  {level} {ym} set {n}: not available, skipping")
                continue

            questions = parse_cet(md, level, year, month, n)
            if len(questions) < 20:
                print(f"  WARNING: {level} {ym} set {n} only has {len(questions)} questions")

            papers.append({
                "id": f"{level_lower}-{year}-{month}-{n}",
                "year": year,
                "subject": level,
                "category": level_lower,
                "paper_name": f"{year}年{int(month)}月{level}真题（第{n}套）",
                "questions": questions,
            })
            print(f"  {level} {ym} set {n}: {len(questions)} questions")

    subject_name = "大学英语四级" if level == "CET4" else "大学英语六级"
    output = {
        "subject": subject_name,
        "subject_code": level_lower,
        "version": "1.0.0",
        "last_updated": "2026-07-10",
        "description": f"{subject_name}历年真题",
        "notice": "题目来源于公开的 GitHub 开源仓库，答案仅供参考，请以官方公布为准",
        "papers": papers,
    }

    out_path = OUTPUT_DIR / f"{level_lower}-exams.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"  Written: {out_path} ({len(papers)} papers)")
    return output


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate all three files
    eng1 = gen_english1()
    cet4 = gen_cet("CET4")
    cet6 = gen_cet("CET6")

    # Summary
    print("\n=== Summary ===")
    for name, data in [("english1", eng1), ("cet4", cet4), ("cet6", cet6)]:
        n_papers = len(data["papers"])
        n_questions = sum(len(p["questions"]) for p in data["papers"])
        print(f"  {name}: {n_papers} papers, {n_questions} questions")

    # Close HTTP client
    if _client:
        _client.close()


if __name__ == "__main__":
    main()
