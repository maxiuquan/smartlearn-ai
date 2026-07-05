"""系统管理 API 路由.

包含：系统配置、运行信息、日志查看、缓存清理、备份/恢复、服务连通性测试、功能状态。
所有端点要求管理员权限。
"""
import json
import logging
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin_user, get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.admin import (
    FeatureStatusResponse,
    SystemConfigResponse,
    SystemConfigUpdateRequest,
    SystemInfoResponse,
    TestResultResponse,
)
from app.services.email_service import email_service
from app.services.feature_flags import get_feature_status
from app.services.payment_service import FeatureNotEnabledError
from app.services.sms_service import sms_service

router = APIRouter()

logger = logging.getLogger(__name__)

# ── Redis 客户端（懒加载，导入失败也不影响模块加载）──
_redis_client = None


def _get_redis_client():
    """懒加载 Redis 客户端。失败时返回 None。"""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis  # noqa: WPS433

        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        return _redis_client
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Redis 客户端初始化失败：{e}")
        return None


# ── 进程启动时间（用于 uptime）──
_PROCESS_START_TS = time.time()

# ── 默认系统配置（内存兜底，Redis 不可用时使用）──
_DEFAULT_SYSTEM_CONFIG: dict[str, Any] = {
    "site_name": "SmartLearn AI",
    "site_description": "智能学习平台",
    "allow_register": True,
    "default_role": "user",
    "max_upload_size": 10485760,  # 10MB
    "allowed_file_types": ["jpg", "jpeg", "png", "gif", "pdf", "doc", "docx"],
}

# 内存中的配置（Redis 不可用时使用）
_in_memory_config: dict[str, Any] = dict(_DEFAULT_SYSTEM_CONFIG)


async def _load_config() -> dict[str, Any]:
    """从 Redis 加载系统配置；不可用则用内存配置。"""
    redis = _get_redis_client()
    if redis is None:
        return dict(_in_memory_config)
    try:
        raw = await redis.get("system:config")
        if raw:
            return json.loads(raw)
        return dict(_DEFAULT_SYSTEM_CONFIG)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"读取 system:config 失败：{e}")
        return dict(_in_memory_config)


async def _save_config(cfg: dict[str, Any]) -> None:
    """保存配置到 Redis；不可用则只存内存。"""
    redis = _get_redis_client()
    if redis is None:
        _in_memory_config.update(cfg)
        return
    try:
        await redis.set("system:config", json.dumps(cfg))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"写入 system:config 失败：{e}")
        _in_memory_config.update(cfg)


async def _record_audit(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    target: str,
    details: Optional[dict] = None,
) -> None:
    """记录审计日志并提交。"""
    log = AuditLog(
        actor=actor.display_name,
        actor_id=actor.id,
        action=action,
        target=target,
        details=details or {},
    )
    db.add(log)
    await db.commit()


# ── 系统配置 ──


@router.get(
    "/config",
    response_model=SystemConfigResponse,
    summary="获取系统配置",
)
async def get_system_config(
    current: User = Depends(get_current_admin_user),
) -> SystemConfigResponse:
    """获取系统配置 + 功能开关状态。"""
    cfg = await _load_config()
    return SystemConfigResponse(
        site_name=cfg.get("site_name", _DEFAULT_SYSTEM_CONFIG["site_name"]),
        site_description=cfg.get(
            "site_description", _DEFAULT_SYSTEM_CONFIG["site_description"]
        ),
        allow_register=cfg.get(
            "allow_register", _DEFAULT_SYSTEM_CONFIG["allow_register"]
        ),
        default_role=cfg.get(
            "default_role", _DEFAULT_SYSTEM_CONFIG["default_role"]
        ),
        max_upload_size=cfg.get(
            "max_upload_size", _DEFAULT_SYSTEM_CONFIG["max_upload_size"]
        ),
        allowed_file_types=cfg.get(
            "allowed_file_types", _DEFAULT_SYSTEM_CONFIG["allowed_file_types"]
        ),
        feature_status=get_feature_status(),
    )


@router.put(
    "/config",
    response_model=SystemConfigResponse,
    summary="更新系统配置",
)
async def update_system_config(
    body: SystemConfigUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> SystemConfigResponse:
    """更新系统配置（存 Redis key system:config）。"""
    cfg = await _load_config()

    changes: dict[str, Any] = {}
    for field in (
        "site_name",
        "site_description",
        "allow_register",
        "default_role",
        "max_upload_size",
        "allowed_file_types",
    ):
        value = getattr(body, field)
        if value is not None:
            changes[field] = {"from": cfg.get(field), "to": value}
            cfg[field] = value

    await _save_config(cfg)

    await _record_audit(
        db,
        actor=current,
        action="system.config.update",
        target="system:config",
        details=changes,
    )

    return SystemConfigResponse(
        site_name=cfg.get("site_name", _DEFAULT_SYSTEM_CONFIG["site_name"]),
        site_description=cfg.get(
            "site_description", _DEFAULT_SYSTEM_CONFIG["site_description"]
        ),
        allow_register=cfg.get(
            "allow_register", _DEFAULT_SYSTEM_CONFIG["allow_register"]
        ),
        default_role=cfg.get(
            "default_role", _DEFAULT_SYSTEM_CONFIG["default_role"]
        ),
        max_upload_size=cfg.get(
            "max_upload_size", _DEFAULT_SYSTEM_CONFIG["max_upload_size"]
        ),
        allowed_file_types=cfg.get(
            "allowed_file_types", _DEFAULT_SYSTEM_CONFIG["allowed_file_types"]
        ),
        feature_status=get_feature_status(),
    )


# ── 系统运行信息 ──


@router.get(
    "/info",
    response_model=SystemInfoResponse,
    summary="系统运行信息",
)
async def get_system_info(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> SystemInfoResponse:
    """获取系统运行信息（版本/uptime/内存/CPU/数据库/Redis）。"""
    # psutil 可选
    memory_usage = 0.0
    cpu_usage = 0.0
    try:
        import psutil  # noqa: WPS433

        memory_usage = psutil.virtual_memory().percent
        cpu_usage = psutil.cpu_percent(interval=0.1)
    except ImportError:
        pass
    except Exception as e:  # noqa: BLE001
        logger.warning(f"psutil 采集失败：{e}")

    # 数据库大小：以 users 行数近似（避免依赖 pg_database_size 权限）
    from sqlalchemy import func, select  # 局部导入避免循环依赖

    db_size = (
        await db.execute(select(func.count()).select_from(User))
    ).scalar() or 0

    # Redis 信息
    redis_info: dict[str, Any] = {}
    redis = _get_redis_client()
    if redis is not None:
        try:
            raw_info = await redis.info()
            redis_info = {
                "connected": True,
                "version": raw_info.get("redis_version"),
                "used_memory_human": raw_info.get("used_memory_human"),
                "connected_clients": raw_info.get("connected_clients"),
                "uptime_in_seconds": raw_info.get("uptime_in_seconds"),
            }
        except Exception as e:  # noqa: BLE001
            redis_info = {"connected": False, "error": str(e)}
    else:
        redis_info = {"connected": False, "error": "redis client unavailable"}

    uptime = time.time() - _PROCESS_START_TS

    return SystemInfoResponse(
        version=settings.APP_VERSION,
        uptime_seconds=round(uptime, 2),
        memory_usage=memory_usage,
        cpu_usage=cpu_usage,
        db_size=db_size,
        redis_info=redis_info,
    )


# ── 系统日志 ──


@router.get(
    "/logs",
    summary="查看系统日志（最近 N 行）",
)
async def get_system_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=1000),
    level: Optional[str] = Query(None, description="按级别筛选：DEBUG/INFO/WARNING/ERROR"),
    action: Optional[str] = Query(None, description="按动作关键字筛选"),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """读取 logs 目录下最新日志文件的最后 N 行。"""
    # 候选日志目录
    candidates = [
        Path("logs"),
        Path("/app/logs"),
        Path(settings.ENVIRONMENT) / "logs",
    ]
    log_dir: Optional[Path] = None
    for c in candidates:
        if c.exists() and c.is_dir():
            log_dir = c
            break

    if log_dir is None:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "message": "未找到日志目录",
        }

    # 找最新的 .log 文件
    log_files = sorted(
        (p for p in log_dir.iterdir() if p.is_file() and p.suffix == ".log"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not log_files:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "message": "日志目录中无 .log 文件",
        }

    log_file = log_files[0]
    try:
        with log_file.open("r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
    except Exception as e:  # noqa: BLE001
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "message": f"读取日志文件失败：{e}",
        }

    # 过滤
    filtered = []
    level_upper = level.upper() if level else None
    for line in all_lines:
        if level_upper and level_upper not in line.upper():
            continue
        if action and action.lower() not in line.lower():
            continue
        filtered.append(line.rstrip("\n"))

    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    page_lines = filtered[start:end]

    return {
        "items": page_lines,
        "total": total,
        "page": page,
        "page_size": page_size,
        "file": str(log_file),
    }


# ── 缓存清理 ──


@router.post(
    "/clear-cache",
    summary="清空 Redis 缓存（保留 system:config）",
)
async def clear_cache(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """清空 Redis 当前 db，但保留 system:config 键。"""
    redis = _get_redis_client()
    if redis is None:
        await _record_audit(
            db,
            actor=current,
            action="system.clear_cache",
            target="redis",
            details={"success": False, "reason": "redis unavailable"},
        )
        return {"message": "Redis 不可用，未执行清理"}

    try:
        # 先备份 system:config
        config_backup = await redis.get("system:config")
        await redis.flushdb()
        if config_backup is not None:
            await redis.set("system:config", config_backup)
        cleared = True
        message = "Redis 缓存已清空（system:config 已保留）"
    except Exception as e:  # noqa: BLE001
        cleared = False
        message = f"清空缓存失败：{e}"

    await _record_audit(
        db,
        actor=current,
        action="system.clear_cache",
        target="redis",
        details={"success": cleared},
    )

    return {"message": message}


# ── 备份与恢复 ──


def _backups_dir() -> Path:
    """返回备份目录。

    优先使用 /app/backups（容器环境），不可创建则回退到项目根 backups。
    """
    candidates = [Path("/app/backups"), Path("backups")]
    for c in candidates:
        try:
            c.mkdir(parents=True, exist_ok=True)
            return c
        except OSError:
            continue
    # 兜底：用项目根 backups
    fallback = Path("backups")
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


@router.get(
    "/backups",
    summary="列出数据库备份文件",
)
async def list_backups(
    current: User = Depends(get_current_admin_user),
) -> dict:
    """列出 backups 目录下的 .sql.gz 文件。"""
    bdir = _backups_dir()
    items = []
    for p in sorted(bdir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if p.is_file() and (p.suffix == ".gz" or p.name.endswith(".sql.gz")):
            stat = p.stat()
            items.append(
                {
                    "id": p.name,
                    "filename": p.name,
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    ).isoformat(),
                }
            )
    return {"items": items, "total": len(items)}


@router.post(
    "/backup",
    summary="执行数据库备份（pg_dump）",
)
async def create_backup(
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """使用 pg_dump + gzip 创建备份文件。"""
    bdir = _backups_dir()
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"{ts}.sql.gz"
    filepath = bdir / filename

    # 用同步 URL（不含 +asyncpg）
    db_url = settings.database_url_sync
    # 设置环境变量传密码，避免命令行暴露
    env = os.environ.copy()
    env["PGPASSWORD"] = settings.POSTGRES_PASSWORD or settings.DB_PASSWORD

    host = settings.POSTGRES_SERVER or settings.DB_HOST
    port = str(settings.POSTGRES_PORT or settings.DB_PORT)
    user = settings.POSTGRES_USER or settings.DB_USER
    name = settings.POSTGRES_DB or settings.DB_NAME

    try:
        # pg_dump | gzip > file
        with filepath.open("wb") as f_out:
            proc = subprocess.Popen(
                ["gzip"],
                stdin=subprocess.PIPE,
                stdout=f_out,
                stderr=subprocess.PIPE,
            )
            dump_proc = subprocess.Popen(
                [
                    "pg_dump",
                    "-h",
                    host,
                    "-p",
                    port,
                    "-U",
                    user,
                    "-d",
                    name,
                ],
                stdout=proc.stdin,
                stderr=subprocess.PIPE,
                env=env,
            )
            proc.stdin.close()
            dump_err = dump_proc.communicate()[1]
            proc_err = proc.communicate()[1]
            dump_rc = dump_proc.returncode
            gzip_rc = proc.returncode

        if dump_rc != 0 or gzip_rc != 0:
            err_msg = (dump_err or b"") + b" | " + (proc_err or b"")
            raise RuntimeError(err_msg.decode("utf-8", errors="replace"))

        size = filepath.stat().st_size
        await _record_audit(
            db,
            actor=current,
            action="system.backup",
            target=f"backup:{filename}",
            details={"filename": filename, "size": size},
        )
        return {
            "message": "备份完成",
            "filename": filename,
            "size": size,
        }
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"备份工具不可用：{e}（请确保 pg_dump / gzip 已安装）",
        )
    except Exception as e:  # noqa: BLE001
        # 清理失败的文件
        try:
            if filepath.exists():
                filepath.unlink()
        except Exception:  # noqa: BLE001
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"备份失败：{e}",
        )


@router.post(
    "/restore/{backup_id}",
    summary="从备份恢复数据库",
)
async def restore_backup(
    backup_id: str,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_admin_user),
) -> dict:
    """从指定 .sql.gz 备份恢复（gunzip | psql）。

    需要超级管理员权限（此处沿用 admin 权限，由调用方谨慎使用）。
    """
    if not current.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="恢复数据库需要超级管理员权限",
        )

    bdir = _backups_dir()
    filepath = bdir / backup_id
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"备份文件 {backup_id} 不存在",
        )

    env = os.environ.copy()
    env["PGPASSWORD"] = settings.POSTGRES_PASSWORD or settings.DB_PASSWORD

    host = settings.POSTGRES_SERVER or settings.DB_HOST
    port = str(settings.POSTGRES_PORT or settings.DB_PORT)
    user = settings.POSTGRES_USER or settings.DB_USER
    name = settings.POSTGRES_DB or settings.DB_NAME

    try:
        with filepath.open("rb") as f_in:
            gunzip_proc = subprocess.Popen(
                ["gunzip", "-c"],
                stdin=f_in,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            psql_proc = subprocess.Popen(
                [
                    "psql",
                    "-h",
                    host,
                    "-p",
                    port,
                    "-U",
                    user,
                    "-d",
                    name,
                    "--set",
                    "ON_ERROR_STOP=on",
                ],
                stdin=gunzip_proc.stdout,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
            )
            gunzip_proc.stdout.close()
            gunzip_err = gunzip_proc.communicate()[1]
            out, psql_err = psql_proc.communicate()
            gunzip_rc = gunzip_proc.returncode
            psql_rc = psql_proc.returncode

        if gunzip_rc != 0 or psql_rc != 0:
            err_msg = (gunzip_err or b"") + b" | " + (psql_err or b"")
            raise RuntimeError(err_msg.decode("utf-8", errors="replace"))

        await _record_audit(
            db,
            actor=current,
            action="system.restore",
            target=f"backup:{backup_id}",
            details={"filename": backup_id},
        )
        return {"message": f"已从 {backup_id} 恢复数据库"}
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"恢复工具不可用：{e}（请确保 gunzip / psql 已安装）",
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"恢复失败：{e}",
        )


# ── 服务连通性测试 ──


@router.post(
    "/test-email",
    response_model=TestResultResponse,
    summary="测试邮件服务连通性",
)
async def test_email(
    current: User = Depends(get_current_admin_user),
) -> TestResultResponse:
    """测试邮件服务（调用 email_service.send_code）。

    未配置时返回 success=False, message="邮件服务未配置"。
    """
    if not email_service.is_enabled:
        return TestResultResponse(
            success=False,
            message="邮件服务未配置",
        )
    try:
        await email_service.send_code("test@smartlearn.local", "123456")
        return TestResultResponse(
            success=True,
            message="邮件服务调用成功（请检查收件箱或服务占位返回）",
        )
    except FeatureNotEnabledError as e:
        return TestResultResponse(
            success=False,
            message="邮件服务未配置",
            detail=str(e),
        )
    except Exception as e:  # noqa: BLE001
        return TestResultResponse(
            success=False,
            message="邮件服务调用失败",
            detail=str(e),
        )


@router.post(
    "/test-sms",
    response_model=TestResultResponse,
    summary="测试短信服务连通性",
)
async def test_sms(
    current: User = Depends(get_current_admin_user),
) -> TestResultResponse:
    """测试短信服务（调用 sms_service.send_code）。

    未配置时返回 success=False, message="短信服务未配置"。
    """
    if not sms_service.is_enabled:
        return TestResultResponse(
            success=False,
            message="短信服务未配置",
        )
    try:
        # 使用一个明显的测试号码
        await sms_service.send_code("10000000000", "123456")
        return TestResultResponse(
            success=True,
            message="短信服务调用成功（请检查服务占位返回）",
        )
    except FeatureNotEnabledError as e:
        return TestResultResponse(
            success=False,
            message="短信服务未配置",
            detail=str(e),
        )
    except Exception as e:  # noqa: BLE001
        return TestResultResponse(
            success=False,
            message="短信服务调用失败",
            detail=str(e),
        )


# ── 功能状态 ──


@router.get(
    "/features",
    response_model=FeatureStatusResponse,
    summary="获取各功能开关状态",
)
async def get_features(
    current: User = Depends(get_current_admin_user),
) -> FeatureStatusResponse:
    """直接返回 get_feature_status() 结果。"""
    return FeatureStatusResponse(features=get_feature_status())
