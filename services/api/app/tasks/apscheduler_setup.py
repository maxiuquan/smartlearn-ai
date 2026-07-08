"""APScheduler 定时任务调度 — 替代 Celery Beat 用于 HF Spaces 单容器部署。

设计说明:
- HF Spaces 单容器内不跑 Celery Worker/Beat（省 2 个进程）
- 用 APScheduler 的 BackgroundScheduler 在 api 进程内跑定时任务
- 任务逻辑复用现有的 Celery 任务函数（直接同步调用,不经过 Redis broker）
- 任务都是 TODO 占位实现,失败不影响业务

定时任务清单（与 celery_app.py 的 beat_schedule 保持一致）:
  - 每天 03:00  数据库备份
  - 每天 04:00  数据完整性校验
  - 每小时整点   批量向量化知识点
  - 每周日 02:00 清理题目解答 AI 痕迹
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _run_task(task_func, task_name: str):
    """安全执行定时任务,异常不传播（避免调度器崩溃）。"""
    try:
        logger.info(f"[APScheduler] 开始执行: {task_name}")
        result = task_func()
        logger.info(f"[APScheduler] 完成: {task_name} → {result}")
    except Exception as e:
        logger.error(f"[APScheduler] 失败: {task_name} → {e}")


def start_scheduler() -> None:
    """启动 APScheduler 后台调度器。"""
    global _scheduler

    if _scheduler is not None:
        logger.warning("APScheduler 已在运行,跳过重复启动")
        return

    # 延迟导入,避免在模块加载时触发 Celery 依赖（HF 部署无 Celery Worker）
    try:
        from app.tasks.data_tasks import backup_database, validate_data_integrity
        from app.tasks.ai_tasks import batch_embed_knowledge_points, clean_question_solutions
    except ImportError as e:
        logger.warning(f"定时任务模块导入失败,跳过 APScheduler: {e}")
        return

    _scheduler = BackgroundScheduler(timezone="Asia/Shanghai")

    # ── 每天凌晨 3:00 数据库备份 ──
    _scheduler.add_job(
        lambda: _run_task(backup_database, "数据库备份"),
        trigger=CronTrigger(hour=3, minute=0),
        id="backup-database-daily",
        replace_existing=True,
    )

    # ── 每天凌晨 4:00 数据完整性校验 ──
    _scheduler.add_job(
        lambda: _run_task(validate_data_integrity, "数据完整性校验"),
        trigger=CronTrigger(hour=4, minute=0),
        id="validate-data-integrity-daily",
        replace_existing=True,
    )

    # ── 每小时整点 批量向量化知识点 ──
    _scheduler.add_job(
        lambda: _run_task(batch_embed_knowledge_points, "批量向量化知识点"),
        trigger=CronTrigger(minute=0),
        id="batch-embed-knowledge-points-hourly",
        replace_existing=True,
    )

    # ── 每周日凌晨 2:00 清理题目解答 ──
    _scheduler.add_job(
        lambda: _run_task(clean_question_solutions, "清理题目解答"),
        trigger=CronTrigger(hour=2, minute=0, day_of_week="sun"),
        id="clean-question-solutions-weekly",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info(
        "APScheduler 已注册 4 个定时任务: "
        "backup-database-daily, validate-data-integrity-daily, "
        "batch-embed-knowledge-points-hourly, clean-question-solutions-weekly"
    )


def shutdown_scheduler() -> None:
    """关闭 APScheduler 调度器。"""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler 已关闭")
