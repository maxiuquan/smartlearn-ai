"""
SmartLearn AI - 启动安全检查
在服务启动前校验关键安全配置，fail-fast 策略。
"""
import os
import sys
import re
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("startup_check")

# ── 已知的弱默认值 / 占位符 ──
WEAK_PATTERNS = [
    r"^changeme",
    r"^your-",
    r"^password$",
    r"^admin$",
    r"^secret$",
    r"^default",
    r"^test",
    r"^example",
    r"^placeholder",
    r"^123456",
    r"^minioadmin$",
    r"^minio123$",
]

FAILED = False


def check_required(env_key: str) -> str:
    """检查环境变量是否存在且非空"""
    value = os.environ.get(env_key, "")
    if not value:
        logger.critical(f"❌ 缺少必需的环境变量: {env_key}")
        global FAILED
        FAILED = True
        return ""
    return value


def check_not_weak(env_key: str, value: str):
    """检查值不是弱密码"""
    if not value:
        return
    for pattern in WEAK_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            logger.critical(
                f"❌ 安全风险: {env_key} 包含弱密码模式 (匹配 '{pattern}')"
            )
            global FAILED
            FAILED = True
            return


def check_min_length(env_key: str, value: str, min_len: int = 12):
    """检查值的最小长度"""
    if not value:
        return
    if len(value) < min_len:
        logger.critical(
            f"❌ 安全风险: {env_key} 长度不足 (当前 {len(value)} 字符, 要求 ≥ {min_len})"
        )
        global FAILED
        FAILED = True


def main():
    logger.info("=" * 60)
    logger.info("SmartLearn AI - 启动安全检查")
    logger.info("=" * 60)

    # 1. JWT_SECRET 检查
    jwt_secret = check_required("JWT_SECRET")
    if jwt_secret:
        check_not_weak("JWT_SECRET", jwt_secret)
        check_min_length("JWT_SECRET", jwt_secret, min_len=32)
        logger.info("✅ JWT_SECRET: 已设置")

    # 2. 数据库密码检查
    db_password = os.environ.get("POSTGRES_PASSWORD", "")
    if db_password:
        check_not_weak("POSTGRES_PASSWORD", db_password)
        check_min_length("POSTGRES_PASSWORD", db_password, min_len=12)
        logger.info("✅ POSTGRES_PASSWORD: 已设置")
    else:
        logger.critical("❌ 缺少必需的环境变量: POSTGRES_PASSWORD")
        FAILED = True

    # 3. Redis 密码检查
    redis_password = os.environ.get("REDIS_PASSWORD", "")
    if redis_password:
        check_not_weak("REDIS_PASSWORD", redis_password)
        check_min_length("REDIS_PASSWORD", redis_password, min_len=12)
        logger.info("✅ REDIS_PASSWORD: 已设置")
    else:
        logger.critical("❌ 缺少必需的环境变量: REDIS_PASSWORD")
        FAILED = True

    # 4. MinIO 凭证检查
    minio_access = os.environ.get("MINIO_ACCESS_KEY", "")
    minio_secret = os.environ.get("MINIO_SECRET_KEY", "")
    if minio_access:
        check_not_weak("MINIO_ACCESS_KEY", minio_access)
        logger.info("✅ MINIO_ACCESS_KEY: 已设置")
    else:
        logger.critical("❌ 缺少必需的环境变量: MINIO_ACCESS_KEY")
        FAILED = True

    if minio_secret:
        check_not_weak("MINIO_SECRET_KEY", minio_secret)
        check_min_length("MINIO_SECRET_KEY", minio_secret, min_len=12)
        logger.info("✅ MINIO_SECRET_KEY: 已设置")
    else:
        logger.critical("❌ 缺少必需的环境变量: MINIO_SECRET_KEY")
        FAILED = True

    # 5. 检查是否在生产环境使用了 DEBUG 模式
    debug = os.environ.get("DEBUG", "").lower()
    environment = os.environ.get("ENVIRONMENT", "development").lower()
    if debug == "true" and environment == "production":
        logger.critical("❌ 安全风险: 生产环境启用了 DEBUG 模式")
        FAILED = True

    # 6. 检查 OPENAI_API_KEY (可选但建议)
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    if openai_key:
        check_not_weak("OPENAI_API_KEY", openai_key)
        logger.info("✅ OPENAI_API_KEY: 已设置")
    else:
        logger.warning("⚠️  OPENAI_API_KEY 未设置 - AI 功能将不可用")

    # ── 结果汇总 ──
    logger.info("=" * 60)
    if FAILED:
        logger.critical("❌ 安全检查失败! 服务将不会启动。")
        logger.critical("请修正以上问题后重新启动服务。")
        sys.exit(1)
    else:
        logger.info("✅ 所有安全检查通过。正在启动服务...")
        logger.info("=" * 60)


if __name__ == "__main__":
    main()