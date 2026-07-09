"""管理后台相关 Pydantic schemas.

包含用户管理、审计日志、系统配置、统计、功能状态等响应/请求模型。
"""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


# ── 用户相关 ──


class UserListItem(BaseModel):
    """用户列表项（精简字段）"""

    id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    status: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    vip_level: int = 0
    vip_expire_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """用户列表响应（分页）"""

    items: list[UserListItem]
    total: int
    page: int
    page_size: int


class SubscriptionInfo(BaseModel):
    """用户订阅信息（用于用户详情）"""

    plan: str = "free"
    status: str = "active"
    end_at: Optional[datetime] = None
    ai_quota_daily: int = 10

    model_config = {"from_attributes": True}


class UserStatsSummary(BaseModel):
    """用户学习统计摘要"""

    question_count: int = 0
    word_count: int = 0
    game_count: int = 0
    ai_conversation_count: int = 0
    study_days: int = 0


class UserDetailResponse(BaseModel):
    """用户详情响应（含订阅与统计）"""

    id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    status: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    wechat_openid: Optional[str] = None
    vip_level: int = 0
    vip_expire_at: Optional[datetime] = None
    ai_quota_daily_override: Optional[int] = None
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    subscription: Optional[SubscriptionInfo] = None
    stats: UserStatsSummary = Field(default_factory=UserStatsSummary)

    model_config = {"from_attributes": True}


class UserCreateRequest(BaseModel):
    """管理员创建用户请求"""

    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    nickname: Optional[str] = Field(None, max_length=100)
    role: str = Field("user", description="user / teacher / admin / super_admin")

    model_config = {"extra": "forbid"}


class UserUpdateRequest(BaseModel):
    """管理员更新用户基本信息请求"""

    nickname: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=255)

    model_config = {"extra": "forbid"}


class UserRoleUpdateRequest(BaseModel):
    """更改用户角色请求"""

    role: Literal["user", "teacher", "admin", "super_admin"] = Field(
        ..., description="user / teacher / admin / super_admin"
    )

    model_config = {"extra": "forbid"}


class UserVipUpdateRequest(BaseModel):
    """更新用户 VIP 等级/有效期/AI 配额覆盖请求"""

    vip_level: int = Field(..., ge=0, le=3, description="0=普通 1=基础 2=高级 3=至尊")
    vip_expire_at: Optional[datetime] = None
    ai_quota_daily_override: Optional[int] = Field(None, ge=0)

    model_config = {"extra": "forbid"}


class UserBanRequest(BaseModel):
    """禁用用户请求"""

    reason: Optional[str] = Field(None, max_length=500)

    model_config = {"extra": "forbid"}


class ResetPasswordRequest(BaseModel):
    """重置用户密码请求"""

    new_password: str = Field(..., min_length=6, max_length=128)

    model_config = {"extra": "forbid"}


# ── 审计日志 ──


class AuditLogResponse(BaseModel):
    """审计日志条目响应"""

    id: int
    actor: str
    actor_id: Optional[int] = None
    action: str
    target: Optional[str] = None
    details: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    """审计日志列表响应（分页）"""

    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int


# ── 系统配置 ──


class SystemConfigResponse(BaseModel):
    """系统配置响应（含 feature_status）"""

    site_name: str = "SmartLearn AI"
    site_description: str = "智能学习平台"
    allow_register: bool = True
    default_role: str = "user"
    max_upload_size: int = 10485760  # 10MB
    allowed_file_types: list[str] = Field(
        default_factory=lambda: ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"]
    )
    feature_status: dict[str, Any] = Field(default_factory=dict)


class SystemConfigUpdateRequest(BaseModel):
    """更新系统配置请求"""

    site_name: Optional[str] = Field(None, max_length=200)
    site_description: Optional[str] = Field(None, max_length=500)
    allow_register: Optional[bool] = None
    default_role: Optional[str] = None
    max_upload_size: Optional[int] = Field(None, ge=1)
    allowed_file_types: Optional[list[str]] = None

    model_config = {"extra": "forbid"}


class SystemInfoResponse(BaseModel):
    """系统运行信息响应"""

    version: str
    uptime_seconds: float = 0.0
    memory_usage: float = 0.0
    cpu_usage: float = 0.0
    db_size: int = 0
    redis_info: dict[str, Any] = Field(default_factory=dict)


class FeatureStatusResponse(BaseModel):
    """功能开关状态响应（结构同 get_feature_status()）"""

    features: dict[str, Any] = Field(default_factory=dict)


class TestResultResponse(BaseModel):
    """服务连通性测试结果"""

    success: bool
    message: str
    detail: Optional[str] = None


# ── 统计 ──


class StatisticsOverviewResponse(BaseModel):
    """统计概览响应"""

    total_users: int = 0
    active_users_7d: int = 0
    new_users_7d: int = 0
    total_questions: int = 0
    total_vocab: int = 0
    total_knowledge_points: int = 0
    total_ai_calls: int = 0
    total_game_sessions: int = 0
    vip_users: int = 0


class UserAnalysisResponse(BaseModel):
    """用户分析响应（趋势 + 分布）"""

    new_users_daily: list[dict[str, Any]] = Field(default_factory=list)
    active_users_daily: list[dict[str, Any]] = Field(default_factory=list)
    role_distribution: dict[str, int] = Field(default_factory=dict)
    vip_distribution: dict[str, int] = Field(default_factory=dict)


# ── 学生端统计（无需 admin 权限） ──


class StudentOverviewResponse(BaseModel):
    """学生端平台概览响应。

    字段对齐学生端 Dashboard 期望：题目总数 / 词汇总数 / 注册用户 / 今日活跃。
    """

    total_questions: int = 0
    total_vocab: int = 0
    total_users: int = 0
    today_active: int = 0


class StudentProfileResponse(BaseModel):
    """学生端个人资料统计响应。

    字段对齐学生端 Profile 期望：答题数 / 正确率 / 学习天数 / 连续打卡 / 掌握词汇 / 学习时长。
    """

    total_study_days: int = 0
    total_questions_answered: int = 0
    total_correct: int = 0
    accuracy: float = 0.0
    total_study_minutes: int = 0
    current_streak: int = 0
    vocab_mastered: int = 0
    last_login_at: Optional[datetime] = None
