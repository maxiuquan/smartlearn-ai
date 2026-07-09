"""获取 HF Space 完整运行日志"""
import re
import requests
from pathlib import Path

cred_path = Path.home() / ".git-credentials"
text = cred_path.read_text(encoding="utf-8")
m = re.search(r"https://[^:]+:([^@]+)@huggingface", text)
token = m.group(1)

# 拉 logs/run 完整内容
resp = requests.get(
    "https://huggingface.co/api/spaces/maxiuquan/xuexi/logs/run",
    headers={"Authorization": f"Bearer {token}"},
    stream=True,
    timeout=30,
)

out_lines = []
for line in resp.iter_lines(decode_unicode=True):
    if line and line.startswith("data: "):
        # 解析 SSE
        import json
        try:
            data = json.loads(line[6:])
            text_chunk = data.get("data", "")
            if text_chunk:
                out_lines.append(text_chunk)
        except Exception:
            pass
    if len(out_lines) > 400:
        break

# 打印关键部分: 开头初始化 + 错误
print("===== 前 80 行(启动 + alembic) =====")
for line in out_lines[:80]:
    print(line)

print()
print("===== 后 60 行(应用日志) =====")
for line in out_lines[-60:]:
    print(line)
