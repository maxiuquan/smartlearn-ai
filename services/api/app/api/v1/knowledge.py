"""知识点相关 API 路由"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_optional_user_id
from app.models.business import KnowledgePoint
from app.schemas.knowledge import (
    KnowledgePointDetailResponse,
    KnowledgePointResponse,
    KnowledgeSearchResponse,
    KnowledgeTreeResponse,
)

router = APIRouter()


@router.get(
    "/tree",
    response_model=list[KnowledgePointResponse],
    summary="获取全部知识点（扁平列表）",
)
async def get_all_knowledge_tree(
    db: AsyncSession = Depends(get_db),
) -> list[KnowledgePointResponse]:
    """返回全部知识点的扁平列表，供前端知识点选择器使用。"""
    result = await db.execute(
        select(KnowledgePoint).order_by(KnowledgePoint.subject, KnowledgePoint.id)
    )
    rows = result.scalars().all()
    return [
        KnowledgePointResponse(
            id=row.id,
            subject=row.subject,
            chapter=row.chapter,
            section=row.section,
            name=row.name,
            description=row.description,
            difficulty=row.difficulty,
            importance=row.importance,
            prerequisites=row.prerequisites,
            keywords=row.keywords,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.get(
    "/search",
    response_model=KnowledgeSearchResponse,
    summary="搜索知识点",
)
async def search_knowledge_points(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    subject: Optional[str] = Query(None, description="限制学科"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeSearchResponse:
    """根据关键词搜索知识点。

    - 支持按名称和描述模糊搜索
    - 可限制学科范围
    """
    conditions = [KnowledgePoint.name.ilike(f"%{q}%")]
    if subject:
        conditions.append(KnowledgePoint.subject == subject)

    # 计数
    count_result = await db.execute(
        select(func.count()).select_from(KnowledgePoint).where(*conditions)
    )
    total = count_result.scalar() or 0

    # 查询
    result = await db.execute(
        select(KnowledgePoint)
        .where(*conditions)
        .order_by(KnowledgePoint.importance.desc())
        .limit(limit)
    )
    rows = result.scalars().all()

    results = [
        KnowledgePointResponse(
            id=row.id,
            subject=row.subject,
            chapter=row.chapter,
            section=row.section,
            name=row.name,
            description=row.description,
            difficulty=row.difficulty,
            importance=row.importance,
            prerequisites=row.prerequisites,
            keywords=row.keywords,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return KnowledgeSearchResponse(
        results=results,
        total=total,
        query=q,
    )


@router.get(
    "/{subject}",
    response_model=KnowledgeTreeResponse,
    summary="获取学科知识点树",
)
async def get_knowledge_tree(
    subject: str,
    db: AsyncSession = Depends(get_db),
) -> KnowledgeTreeResponse:
    """获取指定学科的知识点树结构。

    - 支持的 subject: math, english, linear-algebra, probability 等
    """
    result = await db.execute(
        select(KnowledgePoint)
        .where(KnowledgePoint.subject == subject)
        .order_by(KnowledgePoint.chapter, KnowledgePoint.section, KnowledgePoint.id)
    )
    rows = result.scalars().all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到学科 '{subject}' 的知识点",
        )

    # 构建树结构
    from app.schemas.knowledge import KnowledgeTreeItem

    chapter_map: dict[str, list[KnowledgeTreeItem]] = {}
    for row in rows:
        chapter = row.chapter or "默认"
        if chapter not in chapter_map:
            chapter_map[chapter] = []
        chapter_map[chapter].append(
            KnowledgeTreeItem(id=row.id, name=row.name, children=[])
        )

    tree = [
        KnowledgeTreeItem(
            id=0,
            name=chapter,
            children=items,
        )
        for chapter, items in chapter_map.items()
    ]

    return KnowledgeTreeResponse(
        subject=subject,
        total_points=len(rows),
        tree=tree,
    )


@router.get(
    "/points/{kp_id}",
    response_model=KnowledgePointDetailResponse,
    summary="获取知识点详情",
)
async def get_knowledge_point(
    kp_id: int,
    db: AsyncSession = Depends(get_db),
) -> KnowledgePointDetailResponse:
    """获取单个知识点详情，包含前置知识点信息。

    Args:
        kp_id: 知识点 ID
    """
    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.id == kp_id)
    )
    row = result.scalars().first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"知识点 {kp_id} 不存在",
        )

    # 获取前置知识点详情
    prerequisite_details: list[KnowledgePointResponse] = []
    if row.prerequisites:
        prereq_ids = [
            p["id"] for p in row.prerequisites if isinstance(p, dict) and "id" in p
        ]
        if prereq_ids:
            prereq_result = await db.execute(
                select(KnowledgePoint).where(KnowledgePoint.id.in_(prereq_ids))
            )
            for pr in prereq_result.scalars().all():
                prerequisite_details.append(
                    KnowledgePointResponse(
                        id=pr.id,
                        subject=pr.subject,
                        chapter=pr.chapter,
                        section=pr.section,
                        name=pr.name,
                        description=pr.description,
                        difficulty=pr.difficulty,
                        importance=pr.importance,
                        prerequisites=None,
                        keywords=pr.keywords,
                        created_at=pr.created_at,
                    )
                )

    return KnowledgePointDetailResponse(
        id=row.id,
        subject=row.subject,
        chapter=row.chapter,
        section=row.section,
        name=row.name,
        description=row.description,
        difficulty=row.difficulty,
        importance=row.importance,
        prerequisites=row.prerequisites,
        keywords=row.keywords,
        created_at=row.created_at,
        prerequisite_details=prerequisite_details,
    )
