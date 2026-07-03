"""
智能推题引擎服务
根据用户能力模型推荐题目
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime
import uuid

from config import settings
from models.recommendation import (
    RecommendationRequest,
    RecommendationResponse,
    QuestionRecommendation,
    UserAbilityProfile,
    QuestionType,
    DifficultyLevel
)


class RecommendationService:
    """智能推题引擎"""
    
    def __init__(self):
        self.batch_size = settings.RECOMMENDATION_BATCH_SIZE
        self.difficulty_factor = settings.DIFFICULTY_ADJUSTMENT_FACTOR
    
    async def get_recommendations(
        self, 
        request: RecommendationRequest
    ) -> RecommendationResponse:
        """获取推荐题目"""
        
        # 获取或构建用户能力画像
        user_ability = request.user_ability or self._build_default_ability(request.user_id)
        
        # 计算目标难度范围
        target_difficulty = self._calculate_target_difficulty(user_ability)
        
        # 生成推荐题目
        recommendations = await self._generate_recommendations(
            user_ability=user_ability,
            target_difficulty=target_difficulty,
            count=request.count,
            subject=request.subject,
            knowledge_points=request.knowledge_points,
            difficulty_range=request.difficulty_range,
            exclude_ids=request.exclude_ids or []
        )
        
        # 确定推荐策略
        strategy = self._determine_strategy(user_ability)
        
        return RecommendationResponse(
            user_id=request.user_id,
            recommendations=recommendations,
            total_count=len(recommendations),
            generated_at=datetime.now(),
            strategy=strategy,
            metadata={
                "target_difficulty": target_difficulty,
                "user_overall_ability": user_ability.overall_ability
            }
        )
    
    def _build_default_ability(self, user_id: str) -> UserAbilityProfile:
        """构建默认能力画像"""
        return UserAbilityProfile(
            user_id=user_id,
            overall_ability=0.5,
            subject_abilities={},
            knowledge_mastery={},
            weak_points=[],
            strong_points=[]
        )
    
    def _calculate_target_difficulty(self, ability: UserAbilityProfile) -> float:
        """计算目标难度"""
        # 基于用户能力，推荐略高于当前能力的题目
        base_difficulty = ability.overall_ability
        
        # 添加一些随机性，避免推荐过于单调
        adjustment = np.random.uniform(-0.1, 0.15)
        target = np.clip(base_difficulty + adjustment, 0.1, 0.95)
        
        return float(target)
    
    async def _generate_recommendations(
        self,
        user_ability: UserAbilityProfile,
        target_difficulty: float,
        count: int,
        subject: Optional[str],
        knowledge_points: Optional[List[str]],
        difficulty_range: Optional[tuple],
        exclude_ids: List[str]
    ) -> List[QuestionRecommendation]:
        """生成推荐题目列表"""
        
        recommendations = []
        
        # 确定知识点优先级
        priority_knowledge = self._prioritize_knowledge(
            user_ability, 
            knowledge_points
        )
        
        for i in range(count):
            # 为每个推荐选择知识点
            kp_id = priority_knowledge[i % len(priority_knowledge)] if priority_knowledge else f"kp_{i}"
            
            # 计算该知识点的推荐难度
            kp_mastery = user_ability.knowledge_mastery.get(kp_id, 0.5)
            kp_difficulty = self._adjust_difficulty_for_kp(
                target_difficulty, 
                kp_mastery
            )
            
            # 应用难度范围限制
            if difficulty_range:
                kp_difficulty = np.clip(
                    kp_difficulty,
                    difficulty_range[0],
                    difficulty_range[1]
                )
            
            # 生成推荐
            question_type = self._select_question_type(kp_mastery)
            difficulty_level = self._get_difficulty_level(kp_difficulty)
            
            rec = QuestionRecommendation(
                question_id=f"q_{uuid.uuid4().hex[:8]}",
                knowledge_point_id=kp_id,
                question_type=question_type,
                difficulty=difficulty_level,
                difficulty_score=round(kp_difficulty, 3),
                relevance_score=self._calculate_relevance(kp_mastery),
                priority=i + 1,
                reason=self._generate_reason(kp_mastery, difficulty_level)
            )
            recommendations.append(rec)
        
        return recommendations
    
    def _prioritize_knowledge(
        self,
        ability: UserAbilityProfile,
        specified_kps: Optional[List[str]]
    ) -> List[str]:
        """确定知识点优先级"""
        if specified_kps:
            return specified_kps
        
        # 优先推荐薄弱知识点，然后是中等掌握的
        priority = []
        
        # 薄弱知识点优先
        priority.extend(ability.weak_points)
        
        # 然后是中等掌握的知识点
        medium_mastery = [
            kp for kp, mastery in ability.knowledge_mastery.items()
            if 0.3 < mastery < 0.7 and kp not in priority
        ]
        priority.extend(medium_mastery)
        
        # 最后是其他知识点
        other = [
            kp for kp in ability.knowledge_mastery.keys()
            if kp not in priority
        ]
        priority.extend(other)
        
        # 如果没有知识点数据，返回默认
        if not priority:
            priority = [f"default_kp_{i}" for i in range(5)]
        
        return priority
    
    def _adjust_difficulty_for_kp(
        self, 
        base_difficulty: float, 
        mastery: float
    ) -> float:
        """根据知识点掌握度调整难度"""
        # 掌握度低 -> 推荐较简单题目
        # 掌握度高 -> 推荐较难题目
        adjustment = (mastery - 0.5) * 0.3
        return np.clip(base_difficulty + adjustment, 0.1, 0.95)
    
    def _select_question_type(self, mastery: float) -> QuestionType:
        """选择题目类型"""
        # 根据掌握度选择不同类型
        if mastery < 0.3:
            # 初学阶段，以选择题为主
            types = [QuestionType.CHOICE, QuestionType.FILL]
            weights = [0.7, 0.3]
        elif mastery < 0.6:
            # 中等阶段，混合类型
            types = [QuestionType.CHOICE, QuestionType.FILL, QuestionType.CALCULATION]
            weights = [0.3, 0.4, 0.3]
        else:
            # 高级阶段，以计算和简答为主
            types = [QuestionType.CALCULATION, QuestionType.SHORT_ANSWER, QuestionType.PROOF]
            weights = [0.4, 0.4, 0.2]
        
        return np.random.choice(types, p=weights)
    
    def _get_difficulty_level(self, score: float) -> DifficultyLevel:
        """获取难度等级"""
        if score < 0.25:
            return DifficultyLevel.EASY
        elif score < 0.5:
            return DifficultyLevel.MEDIUM
        elif score < 0.75:
            return DifficultyLevel.HARD
        else:
            return DifficultyLevel.EXPERT
    
    def _calculate_relevance(self, mastery: float) -> float:
        """计算相关性分数"""
        # 最相关的题目是掌握度在0.3-0.7之间的
        optimal_mastery = 0.5
        distance = abs(mastery - optimal_mastery)
        relevance = 1 - distance
        return round(relevance, 3)
    
    def _generate_reason(
        self, 
        mastery: float, 
        difficulty: DifficultyLevel
    ) -> str:
        """生成推荐理由"""
        if mastery < 0.3:
            return f"基础知识巩固，推荐{difficulty.value}难度题目加强理解"
        elif mastery < 0.5:
            return f"进阶练习，通过{difficulty.value}难度题目提升能力"
        elif mastery < 0.7:
            return f"能力提升，挑战{difficulty.value}难度题目突破瓶颈"
        else:
            return f"高阶拓展，{difficulty.value}难度题目巩固 mastery"
    
    def _determine_strategy(self, ability: UserAbilityProfile) -> str:
        """确定推荐策略"""
        if ability.overall_ability < 0.3:
            return "基础巩固策略"
        elif ability.overall_ability < 0.5:
            return "稳步提升策略"
        elif ability.overall_ability < 0.7:
            return "突破进阶策略"
        else:
            return "高阶拓展策略"
