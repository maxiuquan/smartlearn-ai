"""admin 数据管理 API 路由（只读列表 + 占位写操作）.

为 admin 前端的 5 个管理页面提供后端端点：
  - /subjects        学科管理（基于现有数据推断）
  - /vocab/word-books 词书管理（读 data/vocabulary/word-books.json）
  - /past-exams      真题管理（读 data/exam-papers/*.json）
  - /workbooks       习题册管理（读 data/exercise-books/*.json）
  - /knowledge/list  知识点分页列表（基于 KnowledgePoint 表）

设计原则：
- 只读列表端点返回真实数据，让 admin 页面可加载
- 写操作（创建/更新/删除）返回 501，提示"演示环境只读"
- 不新建数据库表，避免 alembic 迁移复杂度
"""
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin_user, get_db
from app.models.business import KnowledgePoint, Question, VocabularyWord
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

# data 目录路径（HF 容器内为 /app/data，本地开发为项目根 data）
_DATA_CANDIDATES = [
    os.environ.get("DATA_DIR", ""),
    "/app/data",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "data")),
]
DATA_DIR = next((p for p in _DATA_CANDIDATES if p and os.path.isdir(p)), "/app/data")


def _read_json(filename: str) -> Any:
    """读取 data 目录下的 JSON 文件，失败返回 None。"""
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"读取 {path} 失败: {e}")
        return None


def _empty_page(page: int, page_size: int) -> dict:
    """返回空分页响应（与后端其他列表端点结构一致）。"""
    return {"items": [], "total": 0, "page": page, "page_size": page_size}


def _not_implemented(feature: str):
    """写操作占位：演示环境只读。"""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"{feature}为只读演示环境，写操作暂未开放",
    )


# ── 学科管理 ──

# 预置学科（与前端 SubjectList 表单选项一致）
_PRESET_SUBJECTS = [
    {"id": "math", "name": "数学", "code": "math", "icon": "calculator", "color": "#1890ff",
     "description": "数学学科", "gradeRange": ["高一", "高二", "高三"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
    {"id": "english", "name": "英语", "code": "english", "icon": "translation", "color": "#52c41a",
     "description": "英语学科", "gradeRange": ["高一", "高二", "高三"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
    {"id": "chinese", "name": "语文", "code": "chinese", "icon": "book", "color": "#eb2f96",
     "description": "语文学科", "gradeRange": ["高一", "高二", "高三"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
    {"id": "physics", "name": "物理", "code": "physics", "icon": "bulb", "color": "#faad14",
     "description": "物理学科", "gradeRange": ["高一", "高二", "高三"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
    {"id": "chemistry", "name": "化学", "code": "chemistry", "icon": "experiment", "color": "#13c2c2",
     "description": "化学学科", "gradeRange": ["高一", "高二", "高三"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
    {"id": "linear-algebra", "name": "线性代数", "code": "linear-algebra", "icon": "apartment", "color": "#722ed1",
     "description": "线性代数（大学）", "gradeRange": ["大一", "大二"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
    {"id": "probability", "name": "概率论", "code": "probability", "icon": "pie-chart", "color": "#fa8c16",
     "description": "概率论与数理统计（大学）", "gradeRange": ["大一", "大二"], "status": True,
     "createdAt": "2026-07-01T00:00:00Z", "updatedAt": "2026-07-01T00:00:00Z"},
]


@router.get("/subjects", summary="获取学科列表")
async def list_subjects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回预置学科列表（分页）。"""
    total = len(_PRESET_SUBJECTS)
    start = (page - 1) * page_size
    items = _PRESET_SUBJECTS[start : start + page_size]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/subjects/all", summary="获取所有学科（不分页）")
async def list_all_subjects(
    current: User = Depends(get_current_admin_user),
) -> list:
    """返回所有预置学科（不分页）。"""
    return _PRESET_SUBJECTS


@router.get("/subjects/{subject_id}", summary="获取学科详情")
async def get_subject(
    subject_id: str,
    current: User = Depends(get_current_admin_user),
) -> dict:
    for s in _PRESET_SUBJECTS:
        if s["id"] == subject_id:
            return s
    raise HTTPException(status_code=404, detail=f"学科 {subject_id} 不存在")


@router.post("/subjects", summary="创建学科")
async def create_subject(current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("学科管理")


@router.put("/subjects/{subject_id}", summary="更新学科")
async def update_subject(subject_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("学科管理")


@router.delete("/subjects/{subject_id}", summary="删除学科")
async def delete_subject(subject_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("学科管理")


@router.post("/subjects/{subject_id}/toggle", summary="启用/禁用学科")
async def toggle_subject(subject_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("学科管理")


@router.get("/subjects/{subject_id}/stats", summary="获取学科统计")
async def get_subject_stats(
    subject_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回学科统计（题目数、知识点数）。"""
    question_count = (
        await db.execute(
            select(func.count()).select_from(Question).where(Question.subject == subject_id)
        )
    ).scalar() or 0
    knowledge_count = (
        await db.execute(
            select(func.count()).select_from(KnowledgePoint).where(KnowledgePoint.subject == subject_id)
        )
    ).scalar() or 0
    return {"questionCount": question_count, "knowledgeCount": knowledge_count, "userCount": 0}


# ── 词书管理 ──

def _load_word_books() -> list:
    """从 data/vocabulary/word-books.json 加载词书列表。"""
    data = _read_json("vocabulary/word-books.json")
    if data is None:
        return []
    # 兼容数组或 {books: [...]} 结构
    books = data if isinstance(data, list) else data.get("books", data.get("word_books", []))
    # 标准化字段
    result = []
    for b in books:
        result.append({
            "id": str(b.get("id", b.get("code", ""))),
            "name": b.get("name", b.get("title", "")),
            "description": b.get("description", ""),
            "cover": b.get("cover", ""),
            "wordCount": b.get("word_count", b.get("wordCount", 0)),
            "subject": b.get("subject", "english"),
            "level": b.get("level", b.get("category", "")),
            "status": b.get("status", True) if not isinstance(b.get("status"), str) else b.get("status") == "active",
            "createdAt": b.get("created_at", b.get("createdAt", "2026-07-01T00:00:00Z")),
            "updatedAt": b.get("updated_at", b.get("updatedAt", "2026-07-01T00:00:00Z")),
        })
    return result


@router.get("/vocab/word-books", summary="获取词书列表")
async def list_word_books(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回词书列表（分页）。"""
    books = _load_word_books()
    total = len(books)
    start = (page - 1) * page_size
    items = books[start : start + page_size]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/vocab/word-books/{book_id}", summary="获取词书详情")
async def get_word_book(
    book_id: str,
    current: User = Depends(get_current_admin_user),
) -> dict:
    books = _load_word_books()
    for b in books:
        if b["id"] == book_id:
            return b
    raise HTTPException(status_code=404, detail=f"词书 {book_id} 不存在")


@router.post("/vocab/word-books", summary="创建词书")
async def create_word_book(current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("词书管理")


@router.put("/vocab/word-books/{book_id}", summary="更新词书")
async def update_word_book(book_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("词书管理")


@router.delete("/vocab/word-books/{book_id}", summary="删除词书")
async def delete_word_book(book_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("词书管理")


@router.post("/vocab/word-books/{book_id}/toggle", summary="启用/禁用词书")
async def toggle_word_book(book_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("词书管理")


@router.get("/vocab/word-books/{book_id}/stats", summary="获取词书统计")
async def get_word_book_stats(
    book_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回词书统计（基于词汇表 tag 字段近似）。"""
    # tag 字段格式如 ["cet4"], 与词书 id 匹配
    word_count = (
        await db.execute(
            select(func.count())
            .select_from(VocabularyWord)
            .where(VocabularyWord.tags.contains([book_id]))
        )
    ).scalar() or 0
    return {"wordCount": word_count, "learnedCount": 0, "userCount": 0}


# ── 真题管理 ──

def _load_exam_papers() -> list:
    """从 data/exam-papers/*.json 加载真题列表。"""
    result = []
    exam_dir = os.path.join(DATA_DIR, "exam-papers")
    if not os.path.isdir(exam_dir):
        return result
    for fname in sorted(os.listdir(exam_dir)):
        if not (fname.endswith(".json") and fname != "schema.json"):
            continue
        path = os.path.join(exam_dir, fname)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        # 兼容数组或单对象
        papers = data if isinstance(data, list) else [data]
        for p in papers:
            questions = p.get("questions", [])
            result.append({
                "id": str(p.get("id", fname.replace(".json", ""))),
                "title": p.get("title", p.get("name", fname)),
                "subject": p.get("subject", ""),
                "year": p.get("year", 2024),
                "province": p.get("province", ""),
                "examType": p.get("exam_type", p.get("examType", "高考")),
                "questions": [q.get("id", str(i)) for i, q in enumerate(questions)],
                "totalScore": p.get("total_score", p.get("totalScore", 0)),
                "duration": p.get("duration", 120),
                "difficulty": p.get("difficulty", 3),
                "status": p.get("status", True),
                "createdAt": p.get("created_at", "2026-07-01T00:00:00Z"),
                "updatedAt": p.get("updated_at", "2026-07-01T00:00:00Z"),
            })
    return result


@router.get("/past-exams", summary="获取真题列表")
async def list_past_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回真题列表（分页）。"""
    papers = _load_exam_papers()
    total = len(papers)
    start = (page - 1) * page_size
    items = papers[start : start + page_size]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/past-exams/stats", summary="获取真题统计")
async def get_past_exam_stats(current: User = Depends(get_current_admin_user)) -> dict:
    papers = _load_exam_papers()
    by_year: dict[int, int] = {}
    by_subject: dict[str, int] = {}
    by_province: dict[str, int] = {}
    for p in papers:
        y = p["year"]
        by_year[y] = by_year.get(y, 0) + 1
        s = p["subject"]
        if s:
            by_subject[s] = by_subject.get(s, 0) + 1
        prov = p.get("province")
        if prov:
            by_province[prov] = by_province.get(prov, 0) + 1
    return {"total": len(papers), "byYear": by_year, "bySubject": by_subject, "byProvince": by_province}


@router.get("/past-exams/{exam_id}", summary="获取真题详情")
async def get_past_exam(
    exam_id: str,
    current: User = Depends(get_current_admin_user),
) -> dict:
    papers = _load_exam_papers()
    for p in papers:
        if p["id"] == exam_id:
            return p
    raise HTTPException(status_code=404, detail=f"真题 {exam_id} 不存在")


@router.post("/past-exams", summary="创建真题")
async def create_past_exam(current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("真题管理")


@router.put("/past-exams/{exam_id}", summary="更新真题")
async def update_past_exam(exam_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("真题管理")


@router.delete("/past-exams/{exam_id}", summary="删除真题")
async def delete_past_exam(exam_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("真题管理")


@router.post("/past-exams/{exam_id}/publish", summary="发布真题")
async def publish_past_exam(exam_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("真题管理")


# ── 习题册管理 ──

def _load_workbooks() -> list:
    """从 data/exercise-books/*.json 加载习题册列表。"""
    result = []
    wb_dir = os.path.join(DATA_DIR, "exercise-books")
    if not os.path.isdir(wb_dir):
        return result
    for fname in sorted(os.listdir(wb_dir)):
        if not (fname.endswith(".json") and fname != "schema.json"):
            continue
        path = os.path.join(wb_dir, fname)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        books = data if isinstance(data, list) else [data]
        for w in books:
            questions = w.get("questions", [])
            result.append({
                "id": str(w.get("id", fname.replace(".json", ""))),
                "name": w.get("name", w.get("title", fname)),
                "subject": w.get("subject", ""),
                "description": w.get("description", ""),
                "cover": w.get("cover", ""),
                "questions": [q.get("id", str(i)) for i, q in enumerate(questions)],
                "difficulty": w.get("difficulty", 3),
                "isPublic": w.get("is_public", w.get("isPublic", True)),
                "creator": w.get("creator", "system"),
                "status": w.get("status", True),
                "createdAt": w.get("created_at", "2026-07-01T00:00:00Z"),
                "updatedAt": w.get("updated_at", "2026-07-01T00:00:00Z"),
            })
    return result


@router.get("/workbooks", summary="获取习题册列表")
async def list_workbooks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回习题册列表（分页）。"""
    books = _load_workbooks()
    total = len(books)
    start = (page - 1) * page_size
    items = books[start : start + page_size]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/workbooks/{workbook_id}", summary="获取习题册详情")
async def get_workbook(
    workbook_id: str,
    current: User = Depends(get_current_admin_user),
) -> dict:
    books = _load_workbooks()
    for w in books:
        if w["id"] == workbook_id:
            return w
    raise HTTPException(status_code=404, detail=f"习题册 {workbook_id} 不存在")


@router.post("/workbooks", summary="创建习题册")
async def create_workbook(current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("习题册管理")


@router.put("/workbooks/{workbook_id}", summary="更新习题册")
async def update_workbook(workbook_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("习题册管理")


@router.delete("/workbooks/{workbook_id}", summary="删除习题册")
async def delete_workbook(workbook_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("习题册管理")


@router.post("/workbooks/{workbook_id}/publish", summary="发布习题册")
async def publish_workbook(workbook_id: str, current: User = Depends(get_current_admin_user)) -> None:
    _not_implemented("习题册管理")


@router.get("/workbooks/{workbook_id}/stats", summary="获取习题册统计")
async def get_workbook_stats(
    workbook_id: str,
    current: User = Depends(get_current_admin_user),
) -> dict:
    """返回习题册统计（基于加载的数据）。"""
    books = _load_workbooks()
    for w in books:
        if w["id"] == workbook_id:
            return {
                "questionCount": len(w.get("questions", [])),
                "completionCount": 0,
                "avgScore": 0,
            }
    raise HTTPException(status_code=404, detail=f"习题册 {workbook_id} 不存在")


# ── 知识点分页列表（补充 /knowledge 列表端点）──

@router.get("/knowledge", summary="获取知识点分页列表")
async def list_knowledge_points(
    subject: Optional[str] = Query(None, description="学科筛选"),
    q: Optional[str] = Query(None, description="名称搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """分页获取知识点列表（admin 知识点管理页面用）。

    - 支持按学科、名称筛选
    - 返回结构与后端其他列表端点一致（items/total/page/page_size）
    """
    conditions = []
    if subject:
        conditions.append(KnowledgePoint.subject == subject)
    if q:
        conditions.append(KnowledgePoint.name.ilike(f"%{q}%"))

    total = (
        await db.execute(
            select(func.count()).select_from(KnowledgePoint).where(*conditions)
        )
    ).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(KnowledgePoint)
        .where(*conditions)
        .order_by(KnowledgePoint.id.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = result.scalars().all()

    items = [
        {
            "id": str(r.id),
            "name": r.name,
            "subject": r.subject,
            "chapter": r.chapter,
            "section": r.section,
            "description": r.description,
            "difficulty": r.difficulty,
            "importance": r.importance,
            "prerequisites": r.prerequisites or [],
            "keywords": r.keywords or [],
            "createdAt": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}
