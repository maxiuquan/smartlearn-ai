"""
单词游戏路由

R8 审计修复：start/submit/summary/leaderboard 四个业务端点已下线（410 Gone），
请使用 API Service 的 /api/v1/games/{game_id}/sessions/start → /answers → /finish 三段式接口。
仅保留 game-types 与 health 两个端点。
"""
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.models.word_games import (
    WordGameRequest,
    WordGameResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    GameSummary,
    LeaderboardRequest,
    LeaderboardResponse
)
from app.services.word_games_service import WordGamesService
from app.auth import require_auth

router = APIRouter(prefix="/word-games", tags=["单词游戏"])

# 服务实例
word_games_service = WordGamesService()


@router.post("/start", response_model=WordGameResponse)
async def start_game(
    request: WordGameRequest,
    auth: dict = Depends(require_auth),
    authorization: Optional[str] = Header(default=None),
):
    """
    开始单词游戏（已下线）

    此接口已下线（410 Gone）。请使用 API Service 的三段式接口：
    /api/v1/games/{game_id}/sessions/start → /answers → /finish
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="此接口已下线（410 Gone）。请使用 API Service 的 /api/v1/games/{game_id}/sessions/start → /answers → /finish 三段式接口。",
    )


@router.post("/submit", response_model=SubmitAnswerResponse)
async def submit_answer(
    request: SubmitAnswerRequest,
    auth: dict = Depends(require_auth),
    authorization: Optional[str] = Header(default=None),
):
    """
    提交答案（已下线）

    此接口已下线（410 Gone）。请使用 API Service 的三段式接口。
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="此接口已下线（410 Gone）。请使用 API Service 的 /api/v1/games/{game_id}/sessions/start → /answers → /finish 三段式接口。",
    )


@router.get("/summary/{session_id}", response_model=GameSummary)
async def get_game_summary(session_id: str, auth: dict = Depends(require_auth)):
    """
    获取游戏总结（已下线）

    此接口已下线（410 Gone）。请使用 API Service 的三段式接口。
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="此接口已下线（410 Gone）。请使用 API Service 的 /api/v1/games/{game_id}/sessions/start → /answers → /finish 三段式接口。",
    )


@router.post("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(request: LeaderboardRequest, auth: dict = Depends(require_auth)):
    """
    获取排行榜（已下线）

    此接口已下线（410 Gone）。请使用 API Service 的三段式接口。
    """
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="此接口已下线（410 Gone）。请使用 API Service 的 /api/v1/games/{game_id}/sessions/start → /answers → /finish 三段式接口。",
    )


@router.get("/game-types")
async def get_game_types():
    """
    获取游戏类型列表
    """
    return {
        "game_types": [
            {"type": "word_match", "name": "单词配对", "description": "将单词与正确的中文意思配对"},
            {"type": "spelling", "name": "拼写练习", "description": "根据中文意思拼写英文单词"},
            {"type": "word_chain", "name": "单词接龙", "description": "用上一个单词的最后一个字母作为下一个单词的首字母"},
            {"type": "fill_blank", "name": "填空", "description": "在句子中填入正确的单词"},
            {"type": "multiple_choice", "name": "选择题", "description": "选择正确的单词"},
            {"type": "listen_write", "name": "听写", "description": "听发音写出单词"},
            {"type": "word_search", "name": "单词搜索", "description": "在字母网格中找出隐藏的单词"},
            {"type": "crossword", "name": "填字游戏", "description": "完成填字游戏"},
        ]
    }


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "word_games"}
