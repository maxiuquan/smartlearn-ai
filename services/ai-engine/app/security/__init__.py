"""
ai-engine 安全防护模块

提供：
- ssrf.is_safe_url / ssrf.safe_http_get_bytes : 出网抓取前的 SSRF 地址校验
"""
from app.security import ssrf

__all__ = ["ssrf"]
