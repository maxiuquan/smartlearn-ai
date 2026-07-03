"""
每日规划服务
智能分配每日学习任务
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime, date, timedelta
from collections import defaultdict
import uuid

from config import settings
from models.daily_planning import (
    DailyPlanRequest,
    DailyPlanResponse,
    DailyPlan,
    DailyTask,
    TaskType,
    TaskPriority,
    UpdatePlanRequest,
    UpdatePlanResponse,
    TaskCompletion,
    WeeklyPlanRequest,
    WeeklyPlanResponse
)


class DailyPlanningService:
    """每日规划服务"""
    
    def __init__(self):
        self.default_goal = settings.DEFAULT_DAILY_GOAL
    
    async def create_daily_plan(
        self,
        request: DailyPlanRequest
    ) -> DailyPlanResponse:
        """创建每日计划"""
        
        target_date = request.date or date.today()
        
        # 获取用户学习数据（模拟）
        pending_reviews = await self._get_pending_reviews(request.user_id)
        weak_knowledge = await self._get_weak_knowledge(request.user_id)
        learning_goals = await self._get_learning_goals(request.user_id)
        
        # 分配任务
        tasks = await self._allocate_tasks(
            available_time=request.available_time_minutes,
            pending_reviews=pending_reviews,
            weak_knowledge=weak_knowledge,
            learning_goals=learning_goals,
            focus_subjects=request.focus_subjects,
            energy_level=request.energy_level or 0.7
        )
        
        # 计算总时间
        total_time = sum(t.estimated_time_minutes for t in tasks)
        
        # 创建计划
        plan = DailyPlan(
            plan_id=f"plan_{uuid.uuid4().hex[:8]}",
            user_id=request.user_id,
            date=target_date,
            tasks=tasks,
            total_time_minutes=total_time,
            total_tasks=len(tasks),
            completed_tasks=0,
            focus_subjects=request.focus_subjects or [],
            goals=self._create_daily_goals(tasks),
            created_at=datetime.now()
        )
        
        # 计算时间分配
        time_distribution = self._calculate_time_distribution(tasks)
        
        # 计算优先级统计
        priority_summary = self._calculate_priority_summary(tasks)
        
        # 生成建议
        recommendations = self._generate_recommendations(plan, request)
        
        return DailyPlanResponse(
            plan=plan,
            time_distribution=time_distribution,
            priority_summary=priority_summary,
            recommendations=recommendations,
            generated_at=datetime.now()
        )
    
    async def update_plan(
        self,
        plan: DailyPlan,
        request: UpdatePlanRequest
    ) -> UpdatePlanResponse:
        """更新计划进度"""
        
        completion = request.task_completion
        
        # 找到并更新任务
        updated_task = None
        for task in plan.tasks:
            if task.task_id == completion.task_id:
                task.is_completed = True
                updated_task = task
                break
        
        if not updated_task:
            raise ValueError(f"Task {completion.task_id} not found")
        
        # 更新计划统计
        plan.completed_tasks = sum(1 for t in plan.tasks if t.is_completed)
        
        # 获取下一个任务
        next_task = self._get_next_task(plan)
        
        # 计算进度
        progress = plan.completed_tasks / plan.total_tasks if plan.total_tasks > 0 else 0
        
        # 生成鼓励语
        encouragement = self._generate_encouragement(progress)
        
        return UpdatePlanResponse(
            plan_id=plan.plan_id,
            updated_task=updated_task,
            remaining_tasks=plan.total_tasks - plan.completed_tasks,
            progress=progress,
            next_task=next_task,
            encouragement=encouragement
        )
    
    async def create_weekly_plan(
        self,
        request: WeeklyPlanRequest
    ) -> WeeklyPlanResponse:
        """创建周计划"""
        
        daily_plans = []
        current_date = request.start_date
        
        for i in range(7):
            # 为每天创建计划
            daily_request = DailyPlanRequest(
                user_id=request.user_id,
                date=current_date,
                available_time_minutes=request.daily_available_minutes
            )
            
            daily_response = await self.create_daily_plan(daily_request)
            daily_plans.append(daily_response.plan)
            
            current_date += timedelta(days=1)
        
        # 计算总时间
        total_time = sum(p.total_time_minutes for p in daily_plans)
        
        # 创建里程碑
        milestones = self._create_weekly_milestones(daily_plans, request.goals)
        
        return WeeklyPlanResponse(
            user_id=request.user_id,
            daily_plans=daily_plans,
            weekly_goals=request.goals or ["完成本周学习目标"],
            total_time_minutes=total_time,
            milestones=milestones,
            generated_at=datetime.now()
        )
    
    async def _get_pending_reviews(self, user_id: str) -> List[Dict]:
        """获取待复习内容（模拟）"""
        return [
            {"knowledge_point_id": "kp_1", "name": "自然数", "priority": 0.9},
            {"knowledge_point_id": "kp_2", "name": "加法运算", "priority": 0.7},
            {"knowledge_point_id": "kp_3", "name": "减法运算", "priority": 0.5},
        ]
    
    async def _get_weak_knowledge(self, user_id: str) -> List[Dict]:
        """获取薄弱知识点（模拟）"""
        return [
            {"knowledge_point_id": "kp_4", "name": "乘法运算", "mastery": 0.3},
            {"knowledge_point_id": "kp_5", "name": "除法运算", "mastery": 0.4},
        ]
    
    async def _get_learning_goals(self, user_id: str) -> List[Dict]:
        """获取学习目标（模拟）"""
        return [
            {"target_id": "kp_8", "name": "方程", "progress": 0.2},
        ]
    
    async def _allocate_tasks(
        self,
        available_time: int,
        pending_reviews: List[Dict],
        weak_knowledge: List[Dict],
        learning_goals: List[Dict],
        focus_subjects: Optional[List[str]],
        energy_level: float
    ) -> List[DailyTask]:
        """分配任务"""
        
        tasks = []
        remaining_time = available_time
        task_order = 0
        
        # 1. 首先安排高优先级复习任务
        for review in sorted(pending_reviews, key=lambda x: -x["priority"]):
            if remaining_time < 10:
                break
            
            task_time = min(20, remaining_time)
            task_order += 1
            
            tasks.append(DailyTask(
                task_id=f"task_{uuid.uuid4().hex[:6]}",
                title=f"复习: {review['name']}",
                task_type=TaskType.REVIEW,
                priority=TaskPriority.HIGH if review["priority"] > 0.7 else TaskPriority.MEDIUM,
                knowledge_point_id=review["knowledge_point_id"],
                estimated_time_minutes=task_time,
                difficulty=0.5,
                question_count=5,
                reason="根据遗忘曲线，需要及时复习"
            ))
            
            remaining_time -= task_time
        
        # 2. 安排薄弱知识点练习
        for weak in weak_knowledge:
            if remaining_time < 15:
                break
            
            task_time = min(25, remaining_time)
            task_order += 1
            
            tasks.append(DailyTask(
                task_id=f"task_{uuid.uuid4().hex[:6]}",
                title=f"强化练习: {weak['name']}",
                task_type=TaskType.PRACTICE,
                priority=TaskPriority.HIGH,
                knowledge_point_id=weak["knowledge_point_id"],
                estimated_time_minutes=task_time,
                difficulty=0.3 + weak["mastery"],
                question_count=8,
                reason="薄弱知识点，需要加强练习"
            ))
            
            remaining_time -= task_time
        
        # 3. 安排新知识学习
        for goal in learning_goals:
            if remaining_time < 20:
                break
            
            task_time = min(30, remaining_time)
            task_order += 1
            
            tasks.append(DailyTask(
                task_id=f"task_{uuid.uuid4().hex[:6]}",
                title=f"学习: {goal['name']}",
                task_type=TaskType.LEARN,
                priority=TaskPriority.MEDIUM,
                knowledge_point_id=goal["target_id"],
                estimated_time_minutes=task_time,
                difficulty=0.6,
                question_count=5,
                reason="学习目标中的新知识"
            ))
            
            remaining_time -= task_time
        
        # 4. 如果还有时间，安排趣味练习
        if remaining_time >= 10:
            tasks.append(DailyTask(
                task_id=f"task_{uuid.uuid4().hex[:6]}",
                title="趣味单词游戏",
                task_type=TaskType.GAME,
                priority=TaskPriority.LOW,
                knowledge_point_id=None,
                estimated_time_minutes=min(15, remaining_time),
                difficulty=0.3,
                question_count=10,
                reason="轻松学习，保持学习兴趣"
            ))
        
        # 根据精力水平调整任务顺序
        if energy_level < 0.5:
            # 精力较低时，先安排简单任务
            tasks.sort(key=lambda x: x.difficulty)
        
        return tasks
    
    def _create_daily_goals(self, tasks: List[DailyTask]) -> List[str]:
        """创建每日目标"""
        goals = []
        
        review_count = sum(1 for t in tasks if t.task_type == TaskType.REVIEW)
        practice_count = sum(1 for t in tasks if t.task_type == TaskType.PRACTICE)
        learn_count = sum(1 for t in tasks if t.task_type == TaskType.LEARN)
        
        if review_count > 0:
            goals.append(f"完成{review_count}项复习任务")
        if practice_count > 0:
            goals.append(f"完成{practice_count}项练习")
        if learn_count > 0:
            goals.append(f"学习{learn_count}个新知识点")
        
        total_questions = sum(t.question_count for t in tasks)
        goals.append(f"完成{total_questions}道题目")
        
        return goals
    
    def _calculate_time_distribution(
        self, 
        tasks: List[DailyTask]
    ) -> Dict[str, int]:
        """计算时间分配"""
        distribution = defaultdict(int)
        
        for task in tasks:
            distribution[task.task_type.value] += task.estimated_time_minutes
        
        return dict(distribution)
    
    def _calculate_priority_summary(
        self, 
        tasks: List[DailyTask]
    ) -> Dict[TaskPriority, int]:
        """计算优先级统计"""
        summary = defaultdict(int)
        
        for task in tasks:
            summary[task.priority] += 1
        
        return dict(summary)
    
    def _generate_recommendations(
        self,
        plan: DailyPlan,
        request: DailyPlanRequest
    ) -> List[str]:
        """生成建议"""
        recommendations = []
        
        # 时间建议
        if plan.total_time_minutes > request.available_time_minutes:
            recommendations.append("任务时间超出可用时间，建议调整优先级")
        
        # 任务类型建议
        task_types = set(t.task_type for t in plan.tasks)
        if TaskType.REVIEW not in task_types:
            recommendations.append("建议安排复习任务，巩固已学知识")
        
        # 精力建议
        if request.energy_level and request.energy_level < 0.5:
            recommendations.append("精力较低时，建议先完成简单任务")
        
        return recommendations
    
    def _get_next_task(self, plan: DailyPlan) -> Optional[DailyTask]:
        """获取下一个待完成任务"""
        # 按优先级排序
        pending = [t for t in plan.tasks if not t.is_completed]
        if not pending:
            return None
        
        priority_order = {
            TaskPriority.HIGH: 0,
            TaskPriority.MEDIUM: 1,
            TaskPriority.LOW: 2
        }
        
        pending.sort(key=lambda x: priority_order[x.priority])
        return pending[0]
    
    def _generate_encouragement(self, progress: float) -> str:
        """生成鼓励语"""
        if progress >= 1.0:
            return "太棒了！今日目标全部完成！"
        elif progress >= 0.75:
            return "进展很好，继续加油！"
        elif progress >= 0.5:
            return "已经完成一半，保持状态！"
        else:
            return "良好的开始，一步步来！"
    
    def _create_weekly_milestones(
        self,
        daily_plans: List[DailyPlan],
        goals: Optional[List[str]]
    ) -> List[Dict]:
        """创建周里程碑"""
        milestones = []
        
        # 周中里程碑
        mid_week_tasks = sum(p.total_tasks for p in daily_plans[:3])
        milestones.append({
            "name": "周中目标",
            "day": 3,
            "target_tasks": mid_week_tasks,
            "description": "完成前三天的学习任务"
        })
        
        # 周末里程碑
        total_tasks = sum(p.total_tasks for p in daily_plans)
        milestones.append({
            "name": "周目标达成",
            "day": 7,
            "target_tasks": total_tasks,
            "description": "完成本周全部学习任务"
        })
        
        return milestones
