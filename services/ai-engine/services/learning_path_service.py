"""
学习路径生成服务
前置知识点链、学习路径
"""
import numpy as np
from typing import List, Optional, Dict, Set
from datetime import datetime, timedelta
from collections import defaultdict, deque
import uuid

from config import settings
from models.learning_path import (
    LearningPathRequest,
    LearningPathResponse,
    LearningPath,
    LearningStep,
    LearningStatus,
    PathProgressUpdate,
    PathProgressResponse,
    AdaptivePathRequest,
    AdaptivePathResponse
)
from services.knowledge_graph_service import KnowledgeGraphService
from models.knowledge_graph import KnowledgeDifficulty


class LearningPathService:
    """学习路径生成服务"""
    
    def __init__(self):
        self.mastery_threshold = settings.MASTERY_THRESHOLD
        self.kg_service = KnowledgeGraphService()
    
    async def generate_path(
        self,
        request: LearningPathRequest
    ) -> LearningPathResponse:
        """生成学习路径"""
        
        # 获取知识图谱
        graph = await self.kg_service._build_or_get_graph("math")
        
        # 获取前置知识
        prereq_response = await self.kg_service.get_prerequisites(
            target_knowledge_id=request.target_knowledge_id,
            user_learned=request.current_knowledge,
            max_depth=5
        )
        
        # 构建学习步骤
        steps = await self._build_learning_steps(
            target_id=request.target_knowledge_id,
            learning_order=prereq_response.learning_order,
            graph=graph,
            mastered=request.mastered_knowledge or [],
            user_ability=0.5  # 默认能力值
        )
        
        # 计算总时间
        total_time = sum(step.estimated_time_minutes for step in steps)
        
        # 创建学习路径
        path = LearningPath(
            path_id=f"path_{uuid.uuid4().hex[:8]}",
            name=f"学习路径: {request.target_knowledge_id}",
            subject="math",
            target_knowledge=request.target_knowledge_id,
            steps=steps,
            total_steps=len(steps),
            total_time_minutes=total_time,
            completed_steps=0,
            progress=0.0,
            created_at=datetime.now()
        )
        
        # 计算预计完成日期
        if request.time_available_minutes:
            days_needed = total_time / request.time_available_minutes
            estimated_completion = datetime.now() + timedelta(days=int(days_needed) + 1)
        else:
            estimated_completion = datetime.now() + timedelta(days=total_time // 60 + 1)
        
        # 生成里程碑
        milestones = self._create_milestones(steps)
        
        # 生成备选路径
        alternative_paths = await self._generate_alternative_paths(
            request, graph
        )
        
        return LearningPathResponse(
            user_id=request.user_id,
            path=path,
            estimated_completion_date=estimated_completion,
            milestones=milestones,
            alternative_paths=alternative_paths,
            generated_at=datetime.now()
        )
    
    async def update_progress(
        self,
        path: LearningPath,
        update: PathProgressUpdate
    ) -> PathProgressResponse:
        """更新学习进度"""
        
        # 找到对应的步骤
        updated_step = None
        for step in path.steps:
            if step.step_id == update.step_id:
                step.status = update.status
                if update.actual_time_minutes:
                    step.estimated_time_minutes = update.actual_time_minutes
                updated_step = step
                break
        
        if not updated_step:
            raise ValueError(f"Step {update.step_id} not found")
        
        # 更新路径统计
        completed = sum(1 for s in path.steps if s.status == LearningStatus.COMPLETED)
        path.completed_steps = completed
        path.progress = completed / path.total_steps if path.total_steps > 0 else 0
        
        # 解锁依赖此步骤的其他步骤
        unlocked = self._unlock_dependent_steps(path, update.step_id)
        
        # 获取下一步
        next_step = self._get_next_step(path)
        
        # 生成鼓励语
        encouragement = self._generate_encouragement(path.progress, update.status)
        
        return PathProgressResponse(
            path_id=path.path_id,
            updated_step=updated_step,
            overall_progress=path.progress,
            next_step=next_step,
            unlocked_steps=unlocked,
            is_completed=path.progress >= 1.0
        )
    
    async def adapt_path(
        self,
        request: AdaptivePathRequest
    ) -> AdaptivePathResponse:
        """自适应调整学习路径"""
        
        adjustments = []
        new_steps = []
        removed_steps = []
        
        # 分析表现，调整路径
        avg_performance = np.mean(list(request.performance.values())) if request.performance else 0.5
        
        if avg_performance < 0.5:
            # 表现较差，增加基础练习
            reason = "检测到学习困难，增加基础练习"
            if request.struggling_points:
                for kp_id in request.struggling_points[:2]:
                    new_steps.append(LearningStep(
                        step_id=f"adapt_{uuid.uuid4().hex[:6]}",
                        knowledge_point_id=kp_id,
                        knowledge_point_name=f"基础巩固: {kp_id}",
                        order=0,
                        status=LearningStatus.NOT_STARTED,
                        estimated_time_minutes=30,
                        difficulty=0.3,
                        prerequisites=[],
                        dependencies=[],
                        resources=[],
                        practice_questions=10,
                        description="针对性基础练习"
                    ))
                    adjustments.append({
                        "type": "add",
                        "knowledge_point": kp_id,
                        "reason": "基础巩固"
                    })
        
        elif avg_performance > 0.8:
            # 表现优秀，可以跳过部分内容
            reason = "学习进展顺利，优化学习路径"
            if request.fast_points:
                for kp_id in request.fast_points[:2]:
                    removed_steps.append(kp_id)
                    adjustments.append({
                        "type": "skip",
                        "knowledge_point": kp_id,
                        "reason": "已快速掌握"
                    })
        
        else:
            reason = "保持当前学习路径"
        
        return AdaptivePathResponse(
            path_id=request.current_path_id,
            adjustments=adjustments,
            new_steps=new_steps,
            removed_steps=removed_steps,
            reason=reason
        )
    
    async def _build_learning_steps(
        self,
        target_id: str,
        learning_order: List[str],
        graph,
        mastered: List[str],
        user_ability: float
    ) -> List[LearningStep]:
        """构建学习步骤"""
        
        steps = []
        mastered_set = set(mastered)
        
        # 获取知识节点信息
        node_info = {node.id: node for node in graph.nodes}
        
        for i, kp_id in enumerate(learning_order + [target_id]):
            node = node_info.get(kp_id)
            
            if node:
                difficulty = self._difficulty_to_score(node.difficulty)
                time = node.estimated_time_minutes
                name = node.name
            else:
                difficulty = 0.5
                time = 30
                name = f"知识点 {kp_id}"
            
            # 确定状态
            if kp_id in mastered_set:
                status = LearningStatus.COMPLETED
            elif i == 0 or all(
                steps[j].status == LearningStatus.COMPLETED
                for j in range(i) if j < len(steps)
            ):
                status = LearningStatus.NOT_STARTED
            else:
                status = LearningStatus.LOCKED
            
            # 前置知识
            prereqs = learning_order[:i] if i > 0 else []
            
            # 依赖步骤
            deps = [f"step_{j}" for j in range(i)] if i > 0 else []
            
            step = LearningStep(
                step_id=f"step_{i}",
                knowledge_point_id=kp_id,
                knowledge_point_name=name,
                order=i + 1,
                status=status,
                estimated_time_minutes=time,
                difficulty=difficulty,
                prerequisites=prereqs,
                dependencies=deps,
                resources=[f"resource_{kp_id}_1", f"resource_{kp_id}_2"],
                practice_questions=int(5 + difficulty * 10),
                description=f"学习 {name} 的相关内容"
            )
            steps.append(step)
        
        return steps
    
    def _difficulty_to_score(self, difficulty: KnowledgeDifficulty) -> float:
        """难度转换为分数"""
        mapping = {
            KnowledgeDifficulty.BASIC: 0.2,
            KnowledgeDifficulty.INTERMEDIATE: 0.5,
            KnowledgeDifficulty.ADVANCED: 0.75,
            KnowledgeDifficulty.EXPERT: 0.95
        }
        return mapping.get(difficulty, 0.5)
    
    def _create_milestones(self, steps: List[LearningStep]) -> List[Dict]:
        """创建里程碑"""
        milestones = []
        
        if len(steps) >= 3:
            # 25%里程碑
            milestones.append({
                "name": "起步阶段完成",
                "step_index": len(steps) // 4,
                "description": "完成基础知识学习"
            })
        
        if len(steps) >= 5:
            # 50%里程碑
            milestones.append({
                "name": "中期目标达成",
                "step_index": len(steps) // 2,
                "description": "掌握核心知识点"
            })
        
        if len(steps) >= 7:
            # 75%里程碑
            milestones.append({
                "name": "冲刺阶段开始",
                "step_index": len(steps) * 3 // 4,
                "description": "进入高级内容学习"
            })
        
        # 100%里程碑
        milestones.append({
            "name": "学习目标达成",
            "step_index": len(steps) - 1,
            "description": "完成全部学习内容"
        })
        
        return milestones
    
    async def _generate_alternative_paths(
        self,
        request: LearningPathRequest,
        graph
    ) -> List[LearningPath]:
        """生成备选路径"""
        # 简化实现：返回一个备选路径
        alternative = LearningPath(
            path_id=f"path_alt_{uuid.uuid4().hex[:6]}",
            name="快速学习路径",
            subject="math",
            target_knowledge=request.target_knowledge_id,
            steps=[],
            total_steps=0,
            total_time_minutes=0,
            completed_steps=0,
            progress=0.0,
            created_at=datetime.now()
        )
        
        return [alternative]
    
    def _unlock_dependent_steps(
        self,
        path: LearningPath,
        completed_step_id: str
    ) -> List[str]:
        """解锁依赖步骤"""
        unlocked = []
        
        for step in path.steps:
            if step.status == LearningStatus.LOCKED:
                # 检查所有依赖是否完成
                all_deps_complete = all(
                    any(
                        s.step_id == dep and s.status == LearningStatus.COMPLETED
                        for s in path.steps
                    )
                    for dep in step.dependencies
                )
                
                if all_deps_complete:
                    step.status = LearningStatus.NOT_STARTED
                    unlocked.append(step.step_id)
        
        return unlocked
    
    def _get_next_step(self, path: LearningPath) -> Optional[LearningStep]:
        """获取下一个待学习的步骤"""
        for step in path.steps:
            if step.status == LearningStatus.NOT_STARTED:
                return step
        return None
    
    def _generate_encouragement(
        self,
        progress: float,
        status: LearningStatus
    ) -> str:
        """生成鼓励语"""
        if status == LearningStatus.COMPLETED:
            if progress >= 1.0:
                return "恭喜！你已完成全部学习内容！"
            elif progress >= 0.75:
                return "太棒了！即将完成学习目标！"
            elif progress >= 0.5:
                return "进展顺利，继续加油！"
            else:
                return "良好的开始，保持学习热情！"
        else:
            return "继续努力，你可以的！"
