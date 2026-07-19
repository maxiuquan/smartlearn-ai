# Security Policy

## Supported Versions

SmartLearn AI 当前只对最新发布版本提供安全更新。每个版本发布后会持续接收安全补丁直至下一个版本发布后 90 天。

| Version | Supported          | Notes                                  |
| ------- | ------------------ | -------------------------------------- |
| 1.x     | :white_check_mark:  | 当前主线，所有安全修复第一时间合入     |
| < 1.0   | :x:                | 历史版本，不再维护，请升级             |

未发布的开发分支（`main` / `master`）不视为"受支持版本"，但我们会响应开发分支上的漏洞报告。

## Reporting a Vulnerability

我们非常欢迎并感谢社区报告安全漏洞。请按以下流程报告：

### 1. 私密报告（推荐）

**不要在公开 issue / PR / 讨论区中披露漏洞细节**。

请通过以下任一渠道私密报告：

- **GitHub 私密漏洞报告**（首选）：
  访问 https://github.com/maxiuquan/smartlearn-ai/security/advisories/new
  使用 GitHub 的 "Report a vulnerability" 功能，提交后会进入私密 advisory。
- **邮件**：发送至 `security@smartlearn.local`（请用项目维护者的 PGP 公钥加密，详见下文）。

### 2. 报告内容

请尽量提供以下信息，便于快速定位与复现：

- 漏洞类型（SQL 注入 / XSS / SSRF / 越权 / 信息泄露 / RCE / 供应链 / 其他）
- 受影响版本（commit SHA 或 tag）
- 受影响组件（`services/api` / `services/ai-engine` / `apps/student-web` / 部署脚本 / CI 配置等）
- 复现步骤（最小可复现 PoC）
- 影响评估（数据泄露 / 服务中断 / 权限提升 / 资金损失）
- 建议的缓解措施（如有）
- 报告者期望的署名方式（用于致谢）

### 3. PGP 公钥（用于加密敏感报告）

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
（PGP 公钥将在首个安全公告中发布；在发布前请使用 GitHub 私密漏洞报告渠道）
-----END PGP PUBLIC KEY BLOCK-----
```

## Response SLA

| 阶段 | 目标响应时间 | 说明 |
| ---- | ------------ | ---- |
| 确认收到报告 | **24 小时**（工作日，北京时间） | 维护者通过原渠道回复确认 |
| 初步评估 | **3 个工作日** | 评估严重性、影响范围、是否确认为漏洞 |
| 修复方案沟通 | **7 个工作日** | 与报告者协商修复方案与披露时间表 |
| 修复发布 | **30 天**（高危）/ 90 天（中危）/ 180 天（低危） | 严重漏洞优先发紧急修复版本 |
| 公开披露 | 修复发布后 **14 天** | 在 GitHub Security Advisory + Release Notes 中公开 |

### 严重性评级

参考 CVSS v3.1：

| 等级 | CVSS 分数 | 例子 |
| ---- | --------- | ---- |
| 严重 Critical | 9.0 - 10.0 | 未鉴权 RCE、SQL 注入绕过认证 |
| 高危 High | 7.0 - 8.9 | 越权访问用户数据、JWT 签名绕过 |
| 中危 Medium | 4.0 - 6.9 | CSRF、XSS（非持久）、限流绕过 |
| 低危 Low | 0.1 - 3.9 | 信息泄露（无敏感数据）、配置错误 |

严重 / 高危漏洞将触发紧急发布流程，优先于其他功能开发。

## Disclosure Policy

- **协同披露**：我们遵循协同披露原则，与报告者协商披露时间表。
- **公开前修复**：在修复版本发布前，不会公开漏洞细节。
- **CVE 编号**：严重 / 高危漏洞将申请 CVE 编号。
- **致谢**：在修复公告中致谢报告者（除非报告者要求匿名）。
- **赏金**：本项目为开源项目，目前不提供现金赏金，但会致谢并永久记录于 SECURITY-HALL-OF-FAME。

## Scope

以下组件在范围内：

- `services/api/` —— FastAPI 后端
- `services/ai-engine/` —— AI 推理服务
- `apps/student-web/` —— 学生端前端
- `apps/admin/` —— 管理端前端
- `apps/mobile/` —— 移动端
- `infra/` —— 部署编排
- `hf-space/` —— HF Space 部署
- `.github/workflows/` —— CI/CD 配置
- 项目根目录的 `Dockerfile` / `docker-compose*.yml`

以下不在范围内：

- 自托管实例的运维问题（请提 issue）
- 第三方依赖自身的漏洞（请直接报告给上游；我们会通过 `safety`/`audit-ci` 主动追踪并升级）
- 已在生产环境打补丁但未公开的漏洞（请通过私密渠道咨询）
- 社会工程学攻击
- 物理安全
- DoS / DDoS（除非有具体可缓解的滥用向量，如缺少限流）
- 由配置错误导致的漏洞，当且仅当文档明确说明正确配置时（请先检查 `.env.example` / `docs/VPS_DEPLOY.md`）

## Security Best Practices (Deployment)

部署本项目的运维方应遵循以下最佳实践：

1. **密钥管理**：所有密钥（`JWT_SECRET` / `DATABASE_URL` / `REDIS_URL` / AI API Key）必须通过环境变量注入，禁止硬编码到镜像或仓库。
2. **生产环境 fail-fast**：`ENVIRONMENT=production` 时应用启动会强制校验密钥强度，未通过则拒绝启动。
3. **TLS**：生产环境必须经 Nginx / 反向代理提供 TLS（参考 `infra/nginx/ssl.conf`）。
4. **限流**：`slowapi` 已对登录/注册接口启用限流，部署方可在 Nginx 层再加一层 IP 限流。
5. **可观测性**：启用 P1-5 的结构化日志与 `/metrics` 端点，接入 ELK / Prometheus 告警。
6. **备份**：`scripts/backup_db.sh` 已就绪，建议配置 cron 每天 3 点备份，保留 7 天。
7. **依赖更新**：CI 已集成 `safety` + `audit-ci`，建议每周跑一次并升级。
8. **最小权限**：PostgreSQL 用户使用应用专用账号，禁止 superuser；Redis 启用 ACL。

## Contact

- 安全相关问题：`security@smartlearn.local` 或 GitHub Security Advisory
- 一般问题：通过 GitHub Issues
- 维护者：@maxiuquan

---

本政策基于 [GitHub Security Policy](https://docs.github.com/code-security/getting-started/adding-a-security-policy-to-your-repository) 与 [Responsible Disclosure](https://en.wikipedia.org/wiki/Coordinated_vulnerability_disclosure) 最佳实践制定。
