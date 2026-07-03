# SmartLearn AI - Makefile
# 常用命令集合

# 变量定义
DOCKER_COMPOSE = docker compose
DOCKER_COMPOSE_FILE = docker-compose.yml
ENV_FILE = .env

# 颜色输出
GREEN = \033[0;32m
YELLOW = \033[0;33m
RED = \033[0;31m
NC = \033[0m

.PHONY: help up down restart build rebuild logs logs-api logs-ai logs-mobile logs-admin ps clean migrate seed import-knowledge import-questions import-vocabulary import-all test lint format dev shell-api shell-ai backup restore status

# 默认目标
help:
	@echo "SmartLearn AI - 常用命令"
	@echo ""
	@echo "服务管理:"
	@echo "  make up              启动所有服务"
	@echo "  make down            停止所有服务"
	@echo "  make restart         重启所有服务"
	@echo "  make build           构建所有镜像"
	@echo "  make rebuild         重新构建并启动"
	@echo "  make ps              查看服务状态"
	@echo ""
	@echo "日志查看:"
	@echo "  make logs            查看所有日志"
	@echo "  make logs-api        查看API服务日志"
	@echo "  make logs-ai         查看AI引擎日志"
	@echo "  make logs-mobile     查看移动端日志"
	@echo "  make logs-admin      查看管理后台日志"
	@echo ""
	@echo "数据管理:"
	@echo "  make migrate         运行数据库迁移"
	@echo "  make seed            填充初始数据"
	@echo "  make import-kp       导入知识点数据"
	@echo "  make import-q        导入题目数据"
	@echo "  make import-vocab    导入词汇数据"
	@echo "  make import-all      导入所有数据"
	@echo ""
	@echo "开发调试:"
	@echo "  make dev             启动开发环境"
	@echo "  make test            运行测试"
	@echo "  make lint            代码检查"
	@echo "  make format          代码格式化"
	@echo "  make shell-api       进入API容器"
	@echo "  make shell-ai        进入AI引擎容器"
	@echo ""
	@echo "备份恢复:"
	@echo "  make backup          备份数据"
	@echo "  make restore         恢复数据"
	@echo "  make clean           清理无用数据"

# ==================== 服务管理 ====================

up:
	@echo "$(GREEN)启动所有服务...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) up -d
	@echo "$(GREEN)服务启动完成！$(NC)"
	@echo "API文档: http://localhost:8000/docs"
	@echo "管理后台: http://localhost:3000"
	@echo "移动端: http://localhost:3001"

down:
	@echo "$(YELLOW)停止所有服务...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) down

restart:
	@echo "$(YELLOW)重启所有服务...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) restart

build:
	@echo "$(GREEN)构建所有镜像...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) build

rebuild:
	@echo "$(GREEN)重新构建并启动...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) build --no-cache
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) up -d

ps:
	@echo "$(GREEN)服务状态:$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) ps

status: ps

# ==================== 日志查看 ====================

logs:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) logs -f

logs-api:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) logs -f api

logs-ai:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) logs -f ai-engine

logs-mobile:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) logs -f mobile-web

logs-admin:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) logs -f admin

# ==================== 数据管理 ====================

migrate:
	@echo "$(GREEN)运行数据库迁移...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api alembic upgrade head

seed:
	@echo "$(GREEN)填充初始数据...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api python scripts/seed.py

import-kp:
	@echo "$(GREEN)导入知识点数据...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api python scripts/import_knowledge.py

import-q:
	@echo "$(GREEN)导入题目数据...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api python scripts/import_questions.py

import-vocab:
	@echo "$(GREEN)导入词汇数据...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api python scripts/import_vocabulary.py

import-all:
	@echo "$(GREEN)导入所有数据...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api python scripts/import_all.py

# ==================== 开发调试 ====================

dev:
	@echo "$(GREEN)启动开发环境...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) -f infra/docker/docker-compose.dev.yml up

test:
	@echo "$(GREEN)运行测试...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api pytest

lint:
	@echo "$(GREEN)代码检查...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api flake8 .
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec ai-engine flake8 .

format:
	@echo "$(GREEN)代码格式化...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api black .
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec ai-engine black .

shell-api:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec api /bin/bash

shell-ai:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec ai-engine /bin/bash

# ==================== 备份恢复 ====================

backup:
	@echo "$(GREEN)备份数据...$(NC)"
	@mkdir -p backups
	@$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec db pg_dump -U ${POSTGRES_USER:-smartlearn_user} smartlearn > backups/db_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)备份完成！$(NC)"

restore:
	@echo "$(YELLOW)恢复数据...$(NC)"
	@echo "请指定备份文件: make restore FILE=backups/db_xxx.sql"

restore-file:
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) exec -T db psql -U ${POSTGRES_USER:-smartlearn_user} smartlearn < $(FILE)

clean:
	@echo "$(YELLOW)清理无用数据...$(NC)"
	$(DOCKER_COMPOSE) -f $(DOCKER_COMPOSE_FILE) --env-file $(ENV_FILE) down -v --remove-orphans
	docker system prune -f
	@echo "$(GREEN)清理完成！$(NC)"
