"""
遗忘曲线算法服务
艾宾浩斯遗忘曲线实现
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import uuid

from config import settings
from models.forgetting_curve import (
    ForgettingCurveRequest,
    ForgettingCurveResponse,
    ReviewSchedule,
    LearningRecord,
    MemoryStrength,
    UpdateMemoryRequest,
    UpdateMemoryResponse,
    ReviewResult
)


class ForgettingCurveService:
    """艾宾浩斯遗忘曲线服务"""
    
    # 艾宾浩斯复习间隔（天）
    EBBINGHAUS_INTERVALS = [1, 2, 4, 7, 15, 30, 60, 90, 180, 365]
    
    def __init__(self):
        self.base = settings.FORGETTING_BASE
        self.decay = settings.FORGETTING_DECAY
    
    async def calculate_review_schedule(
        self,
        request: ForgettingCurveRequest
    ) -> ForgettingCurveResponse:
        """计算复习计划"""
        
        # 获取用户的学习记录
        learning_records = request.learning_records or []
        
        # 生成复习计划
        schedules = await self._generate_schedules(
            user_id=request.user_id,
            learning_records=learning_records,
            knowledge_point_id=request.knowledge_point_id,
            days_ahead=request.days_ahead
        )
        
        # 统计数据
        overdue_count = sum(1 for s in schedules if s.is_overdue)
        upcoming_count = sum(1 for s in schedules if not s.is_overdue)
        avg_retention = np.mean([s.retention_rate for s in schedules]) if schedules else 0
        
        # 生成曲线数据点
        curve_data = self._generate_curve_data(days=request.days_ahead)
        
        return ForgettingCurveResponse(
            user_id=request.user_id,
            schedules=schedules,
            overdue_count=overdue_count,
            upcoming_count=upcoming_count,
            average_retention=round(avg_retention, 3),
            curve_data=curve_data,
            generated_at=datetime.now()
        )
    
    async def update_memory(
        self,
        request: UpdateMemoryRequest
    ) -> UpdateMemoryResponse:
        """更新记忆状态"""
        
        result = request.review_result
        
        # 计算新的记忆强度
        new_strength = self._calculate_new_memory_strength(
            performance=result.performance,
            correct=result.correct
        )
        
        # 计算新的复习间隔
        new_interval = self._calculate_next_interval(
            performance=result.performance,
            current_interval=1  # 默认当前间隔
        )
        
        # 计算下次复习日期
        next_review = datetime.now() + timedelta(days=new_interval)
        
        # 计算新的保持率
        retention = self._calculate_retention(days=new_interval)
        
        return UpdateMemoryResponse(
            knowledge_point_id=result.knowledge_point_id,
            new_memory_strength=new_strength,
            new_retention_rate=round(retention, 3),
            next_review_date=next_review,
            review_interval_days=new_interval
        )
    
    async def _generate_schedules(
        self,
        user_id: str,
        learning_records: List[LearningRecord],
        knowledge_point_id: Optional[str],
        days_ahead: int
    ) -> List[ReviewSchedule]:
        """生成复习计划列表"""
        
        # 如果没有学习记录，生成模拟数据
        if not learning_records:
            learning_records = self._generate_mock_records(knowledge_point_id)
        
        schedules = []
        now = datetime.now()
        
        for record in learning_records:
            # 计算经过的天数
            days_passed = (now - record.learned_at).days
            
            # 计算记忆保持率
            retention = self._calculate_retention(days=days_passed)
            
            # 确定下次复习时间
            review_count = self._estimate_review_count(days_passed)
            next_interval = self._get_next_interval(review_count, record.performance)
            next_review = record.learned_at + timedelta(
                days=sum(self.EBBINGHAUS_INTERVALS[:review_count + 1])
            )
            
            # 判断是否过期
            is_overdue = next_review < now
            
            # 确定记忆强度
            memory_strength = self._get_memory_strength(retention)
            
            # 计算优先级
            priority = self._calculate_priority(is_overdue, retention, record.performance)
            
            schedule = ReviewSchedule(
                knowledge_point_id=record.knowledge_point_id,
                knowledge_point_name=f"知识点_{record.knowledge_point_id}",
                next_review_date=next_review,
                review_interval_days=next_interval,
                memory_strength=memory_strength,
                retention_rate=round(retention, 3),
                review_count=review_count,
                priority=priority,
                is_overdue=is_overdue
            )
            schedules.append(schedule)
        
        # 按优先级排序
        schedules.sort(key=lambda x: x.priority)
        
        return schedules
    
    def _calculate_retention(self, days: int) -> float:
        """
        计算记忆保持率
        艾宾浩斯遗忘曲线: R = e^(-t/S)
        其中 R 是保持率，t 是时间，S 是记忆稳定性
        """
        # 使用简化的遗忘曲线公式
        retention = np.exp(-self.decay * days / 10)
        return float(np.clip(retention, 0, 1))
    
    def _get_next_interval(self, review_count: int, performance: float) -> int:
        """获取下次复习间隔"""
        # 根据表现调整间隔
        if review_count < len(self.EBBINGHAUS_INTERVALS):
            base_interval = self.EBBINGHAUS_INTERVALS[review_count]
        else:
            base_interval = self.EBBINGHAUS_INTERVALS[-1]
        
        # 表现好则延长间隔，表现差则缩短
        adjustment = 1 + (performance - 0.5) * 0.5
        adjusted_interval = int(base_interval * adjustment)
        
        return max(1, adjusted_interval)
    
    def _estimate_review_count(self, days_passed: int) -> int:
        """估算已复习次数"""
        cumulative_days = 0
        for i, interval in enumerate(self.EBBINGHAUS_INTERVALS):
            cumulative_days += interval
            if cumulative_days > days_passed:
                return i
        return len(self.EBBINGHAUS_INTERVALS) - 1
    
    def _get_memory_strength(self, retention: float) -> MemoryStrength:
        """获取记忆强度等级"""
        if retention >= 0.9:
            return MemoryStrength.MASTERED
        elif retention >= 0.7:
            return MemoryStrength.STRONG
        elif retention >= 0.5:
            return MemoryStrength.MEDIUM
        elif retention >= 0.3:
            return MemoryStrength.WEAK
        else:
            return MemoryStrength.NEW
    
    def _calculate_priority(
        self, 
        is_overdue: bool, 
        retention: float,
        performance: float
    ) -> int:
        """计算复习优先级"""
        if is_overdue:
            # 过期的优先级最高
            return 1
        else:
            # 根据保持率和表现计算优先级
            # 保持率越低，优先级越高
            priority = int((1 - retention) * 10) + 1
            return min(priority, 10)
    
    def _calculate_new_memory_strength(
        self,
        performance: float,
        correct: bool
    ) -> MemoryStrength:
        """计算新的记忆强度"""
        if correct and performance >= 0.9:
            return MemoryStrength.MASTERED
        elif correct and performance >= 0.7:
            return MemoryStrength.STRONG
        elif performance >= 0.5:
            return MemoryStrength.MEDIUM
        elif performance >= 0.3:
            return MemoryStrength.WEAK
        else:
            return MemoryStrength.NEW
    
    def _generate_mock_records(
        self, 
        knowledge_point_id: Optional[str]
    ) -> List[LearningRecord]:
        """生成模拟学习记录"""
        now = datetime.now()
        
        if knowledge_point_id:
            kp_ids = [knowledge_point_id]
        else:
            kp_ids = [f"kp_{i}" for i in range(1, 6)]
        
        records = []
        for i, kp_id in enumerate(kp_ids):
            # 模拟不同时间学习的知识点
            days_ago = [1, 3, 7, 15, 30][i % 5]
            records.append(LearningRecord(
                knowledge_point_id=kp_id,
                learned_at=now - timedelta(days=days_ago),
                performance=np.random.uniform(0.5, 0.9),
                time_spent_minutes=np.random.randint(10, 30)
            ))
        
        return records
    
    def _generate_curve_data(self, days: int) -> Dict:
        """生成曲线数据点"""
        data_points = []
        for day in range(days + 1):
            retention = self._calculate_retention(day)
            data_points.append({
                "day": day,
                "retention": round(retention, 3)
            })
        
        return {
            "points": data_points,
            "formula": "R = e^(-0.03t)",
            "description": "艾宾浩斯遗忘曲线"
        }
