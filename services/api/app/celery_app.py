"""Celery 应用配置 - Redis 作为 broker 和结果后端"""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "smartlearn",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.ai_tasks",
        "app.tasks.data_tasks",
    ],
)

# Celery 配置
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 分钟超时
    task_soft_time_limit=25 * 60,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
)

# 任务路由
celery_app.conf.task_routes = {
    "app.tasks.ai_tasks.*": {"queue": "ai"},
    "app.tasks.data_tasks.*": {"queue": "data"},
    "app.tasks.scheduler.*": {"queue": "default"},
}

# 定时任务调度 (Celery Beat)
celery_app.conf.beat_schedule = {
    "backup-database-daily": {
        "task": "app.tasks.data_tasks.backup_database",
        "schedule": crontab(hour=3, minute=0),  # 每天凌晨 3 点
        "options": {"queue": "data"},
    },
    "validate-data-integrity-daily": {
        "task": "app.tasks.data_tasks.validate_data_integrity",
        "schedule": crontab(hour=4, minute=0),  # 每天凌晨 4 点
        "options": {"queue": "data"},
    },
    "batch-embed-knowledge-points-hourly": {
        "task": "app.tasks.ai_tasks.batch_embed_knowledge_points",
        "schedule": crontab(minute=0),  # 每小时
        "options": {"queue": "ai"},
    },
    "clean-question-solutions-weekly": {
        "task": "app.tasks.ai_tasks.clean_question_solutions",
        "schedule": crontab(hour=2, minute=0, day_of_week=0),  # 每周日凌晨 2 点
        "options": {"queue": "ai"},
    },
}