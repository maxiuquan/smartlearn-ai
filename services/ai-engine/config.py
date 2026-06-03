"""
AI Engine Service Configuration
"""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application Settings"""
    
    # Service Info
    APP_NAME: str = "SmartLearn AI Engine"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Server Config
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # AI Engine Config
    # Forgetting Curve (Ebbinghaus)
    FORGETTING_BASE: float = 2.0  # 艾宾浩斯遗忘曲线基数
    FORGETTING_DECAY: float = 0.3  # 衰减系数
    
    # Ability Assessment
    ABILITY_LEVELS: int = 10  # 能力等级数量
    MIN_QUESTIONS_FOR_ASSESSMENT: int = 5  # 最小评估题目数
    
    # Recommendation
    RECOMMENDATION_BATCH_SIZE: int = 10  # 推荐题目批次大小
    DIFFICULTY_ADJUSTMENT_FACTOR: float = 0.1  # 难度调整因子
    
    # Knowledge Graph
    MAX_PREREQUISITE_DEPTH: int = 5  # 最大前置知识深度
    
    # Learning Path
    DEFAULT_DAILY_GOAL: int = 20  # 默认每日目标题目数
    MASTERY_THRESHOLD: float = 0.8  # 掌握阈值
    
    # Word Games
    WORD_GAME_TIME_LIMIT: int = 60  # 单词游戏时间限制(秒)
    WORD_GAME_BATCH_SIZE: int = 10  # 单词游戏批次大小
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
