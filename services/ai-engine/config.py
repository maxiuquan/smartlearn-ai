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
    DEBUG: bool = False
    
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
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
    
    # ============================================================
    # LLM / OpenAI 配置 (兼容旧版)
    # ============================================================
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL_NAME: str = "gpt-4o-mini"
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.7
    
    # Embedding 配置 (兼容旧版)
    EMBEDDING_MODEL_NAME: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536
    
    # ============================================================
    # 多供应商配置 (Multi-Provider)
    # ============================================================
    # --- GLM (智谱 AI) - 默认聊天主供应商 ---
    GLM_API_KEY: str = ""
    GLM_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4/"
    GLM_MODEL: str = "glm-4-flash"
    
    # --- DeepSeek - 高难度问题供应商 ---
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_MODEL: str = "deepseek-chat"
    
    # --- SiliconFlow (硅基流动) - 嵌入/TTS/STT ---
    SILICONFLOW_API_KEY: str = ""
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"
    SILICONFLOW_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    SILICONFLOW_TTS_MODEL: str = "CosyVoice"
    SILICONFLOW_STT_MODEL: str = "SenseVoice"
    
    # --- CogView (智谱 AI) - 图像生成 ---
    COGVIEW_API_KEY: str = ""
    COGVIEW_BASE_URL: str = "https://open.bigmodel.cn/api/paas/v4/"
    COGVIEW_MODEL: str = "cogview-3-flash"
    
    # ============================================================
    # 向量存储配置
    # ============================================================
    VECTOR_STORE_TYPE: str = "inmemory"  # "milvus" | "inmemory"
    MILVUS_HOST: str = "localhost"
    MILVUS_PORT: int = 19530
    MILVUS_COLLECTION_NAME: str = "smartlearn_knowledge"
    
    # ============================================================
    # RAG 配置
    # ============================================================
    RAG_TOP_K: int = 5
    RAG_CHUNK_SIZE: int = 500
    RAG_SIMILARITY_THRESHOLD: float = 0.3
    
    # ============================================================
    # 离线模式
    # ============================================================
    # 离线模式 (无任何 API Key 时使用模拟响应)
    @property
    def offline_mode(self) -> bool:
        return not self.has_any_provider
    
    @property
    def has_any_provider(self) -> bool:
        """是否有任何可用的 AI 供应商"""
        return bool(
            self.OPENAI_API_KEY
            or self.GLM_API_KEY
            or self.DEEPSEEK_API_KEY
            or self.SILICONFLOW_API_KEY
            or self.COGVIEW_API_KEY
        )
    
    @property
    def active_providers(self) -> list[str]:
        """列出当前已配置的活跃供应商"""
        providers: list[str] = []
        if self.OPENAI_API_KEY:
            providers.append("openai")
        if self.GLM_API_KEY:
            providers.append("glm")
        if self.DEEPSEEK_API_KEY:
            providers.append("deepseek")
        if self.SILICONFLOW_API_KEY:
            providers.append("siliconflow")
        if self.COGVIEW_API_KEY:
            providers.append("cogview")
        return providers
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
