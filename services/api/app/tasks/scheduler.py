"""Celery Beat 调度器配置

定时任务调度已整合到 celery_app.py 的 beat_schedule 中。
此模块提供调度器相关的辅助函数和任务注册。
"""
from app.celery_app import celery_app

# 调度器任务可通过 celery_app 直接访问
# 定时配置在 celery_app.py 的 beat_schedule 中定义：
# - 每日: backup_database, validate_data_integrity
# - 每小时: batch_embed_knowledge_points
# - 每周: clean_question_solutions

__all__ = ["celery_app"]