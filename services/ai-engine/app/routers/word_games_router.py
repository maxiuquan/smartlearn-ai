"""
单词游戏路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, Header

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
    开始单词游戏

    创建新的游戏会话：
    - 选择游戏类型
    - 选择单词
    - 设置时间限制

    6.1②：透传 auth 到 service，JWT sub 优先作 user_id。
    词汇联动：透传 authorization token，service 用它调 api 获取今日学过的词汇。
    """
    return await word_games_service.start_game(request, auth=auth, auth_token=authorization)


@router.post("/submit", response_model=SubmitAnswerResponse)
async def submit_answer(
    request: SubmitAnswerRequest,
    auth: dict = Depends(require_auth),
    authorization: Optional[str] = Header(default=None),
):
    """
    提交答案

    提交当前问题的答案：
    - 判断正误
    - 计算得分
    - 获取下一题

    6.1②：透传 auth，校验 session 归属。
    词汇联动：透传 authorization token，service 用它向 api 提交 word event。
    """
    return await word_games_service.submit_answer(request, auth=auth, auth_token=authorization)


@router.get("/summary/{session_id}", response_model=GameSummary)
async def get_game_summary(session_id: str, auth: dict = Depends(require_auth)):
    """
    获取游戏总结

    游戏结束后的总结：
    - 得分统计
    - 正确率
    - 需要加强的单词
    - 排名和徽章

    6.3：加 require_auth 防 IDOR（只能查自己的 session）。
    6.1②：透传 auth，service 层校验 session 归属。
    """
    return await word_games_service.get_game_summary(session_id, auth=auth)


@router.post("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(request: LeaderboardRequest, auth: dict = Depends(require_auth)):
    """
    获取排行榜

    查看游戏排行榜

    6.2⑥：支持按 game_id 分榜。
    """
    return await word_games_service.get_leaderboard(request, auth=auth)


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