"""
能力评估服务
用户能力等级评估
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime
from collections import defaultdict

from config import settings
from models.ability_assessment import (
    AbilityAssessmentRequest,
    AbilityAssessmentResponse,
    UserAbility,
    QuestionPerformance,
    AbilityLevel,
    SubjectType,
    BatchAssessmentRequest,
    BatchAssessmentResponse
)


class AbilityAssessmentService:
    """能力评估服务"""
    
    def __init__(self):
        self.ability_levels = settings.ABILITY_LEVELS
        self.min_questions = settings.MIN_QUESTIONS_FOR_ASSESSMENT
    
    async def assess_ability(
        self,
        request: AbilityAssessmentRequest
    ) -> AbilityAssessmentResponse:
        """评估用户能力"""
        
        performances = request.performances
        
        # 检查是否有足够的数据
        if len(performances) < self.min_questions:
            # 数据不足，返回初步评估
            return await self._preliminary_assessment(request)
        
        # 计算综合能力值
        ability_value = self._calculate_ability_value(
            performances,
            request.previous_ability
        )
        
        # 确定能力等级
        level_score = self._ability_to_level_score(ability_value)
        ability_level = self._get_ability_level(level_score)
        
        # 计算置信度
        confidence = self._calculate_confidence(performances)
        
        # 创建能力对象
        ability = UserAbility(
            subject=request.subject,
            level=ability_level,
            level_score=level_score,
            ability_value=round(ability_value, 3),
            confidence=round(confidence, 3),
            assessed_at=datetime.now()
        )
        
        # 计算各知识点能力
        knowledge_abilities = self._calculate_knowledge_abilities(performances)
        
        # 生成提升建议
        suggestions = self._generate_suggestions(ability_value, knowledge_abilities)
        
        # 预估升级时间
        time_to_next = self._estimate_time_to_next_level(
            ability_value,
            level_score,
            performances
        )
        
        return AbilityAssessmentResponse(
            user_id=request.user_id,
            subject=request.subject,
            ability=ability,
            knowledge_abilities=knowledge_abilities,
            improvement_suggestions=suggestions,
            estimated_time_to_next_level=time_to_next,
            assessed_at=datetime.now()
        )
    
    async def batch_assess(
        self,
        request: BatchAssessmentRequest
    ) -> BatchAssessmentResponse:
        """批量评估多科目能力"""
        
        abilities = []
        
        # 按科目分组表现
        subject_performances = defaultdict(list)
        for perf in request.performances:
            # 假设每个表现都有科目信息（简化处理）
            for subject in request.subjects:
                subject_performances[subject].append(perf)
        
        # 评估每个科目
        for subject in request.subjects:
            perfs = subject_performances.get(subject, [])
            if perfs:
                ability_value = self._calculate_ability_value(perfs, None)
                level_score = self._ability_to_level_score(ability_value)
                
                abilities.append(UserAbility(
                    subject=subject,
                    level=self._get_ability_level(level_score),
                    level_score=level_score,
                    ability_value=round(ability_value, 3),
                    confidence=0.7,
                    assessed_at=datetime.now()
                ))
            else:
                # 没有数据的科目
                abilities.append(UserAbility(
                    subject=subject,
                    level=AbilityLevel.BEGINNER,
                    level_score=1,
                    ability_value=0.1,
                    confidence=0.3,
                    assessed_at=datetime.now()
                ))
        
        # 计算综合能力
        overall = np.mean([a.ability_value for a in abilities])
        
        # 找出最强和最弱科目
        sorted_abilities = sorted(abilities, key=lambda x: x.ability_value)
        weakest = sorted_abilities[0].subject
        strongest = sorted_abilities[-1].subject
        
        return BatchAssessmentResponse(
            user_id=request.user_id,
            abilities=abilities,
            overall_ability=round(overall, 3),
            strongest_subject=strongest,
            weakest_subject=weakest
        )
    
    async def _preliminary_assessment(
        self,
        request: AbilityAssessmentRequest
    ) -> AbilityAssessmentResponse:
        """初步评估（数据不足时）"""
        
        # 基于有限数据给出初步评估
        if request.performances:
            correct_rate = sum(1 for p in request.performances if p.is_correct) / len(request.performances)
            ability_value = correct_rate * 0.5  # 保守估计
        else:
            ability_value = 0.1
        
        level_score = max(1, int(ability_value * 10))
        
        ability = UserAbility(
            subject=request.subject,
            level=AbilityLevel.BEGINNER,
            level_score=level_score,
            ability_value=round(ability_value, 3),
            confidence=0.3,
            assessed_at=datetime.now()
        )
        
        return AbilityAssessmentResponse(
            user_id=request.user_id,
            subject=request.subject,
            ability=ability,
            knowledge_abilities={},
            improvement_suggestions=["继续练习以获取更准确的能力评估"],
            estimated_time_to_next_level=20,
            assessed_at=datetime.now()
        )
    
    def _calculate_ability_value(
        self,
        performances: List[QuestionPerformance],
        previous_ability: Optional[float]
    ) -> float:
        """计算能力值"""
        
        # 使用IRT-like模型简化版本
        # 能力 = 加权正确率 * 难度因子 * 时间因子
        
        total_weight = 0
        weighted_score = 0
        
        for perf in performances:
            # 难度权重：答对难题得分更高
            difficulty_weight = 0.5 + perf.difficulty
            
            # 时间因子：快速正确得分更高
            expected_time = 60 * (1 + perf.difficulty)  # 预期时间
            time_factor = min(1.5, expected_time / max(perf.time_spent_seconds, 1))
            
            # 计算权重
            weight = difficulty_weight * time_factor
            total_weight += weight
            
            # 计算得分
            if perf.is_correct:
                weighted_score += weight * (1 + perf.difficulty * 0.5)
            else:
                weighted_score += weight * 0.1 * (1 - perf.difficulty)
        
        ability = weighted_score / total_weight if total_weight > 0 else 0.5
        
        # 如果有之前的能力值，进行平滑更新
        if previous_ability is not None:
            alpha = 0.3  # 新数据权重
            ability = alpha * ability + (1 - alpha) * previous_ability
        
        return float(np.clip(ability, 0, 1))
    
    def _ability_to_level_score(self, ability: float) -> int:
        """将能力值转换为等级分数"""
        # 能力值 0-1 映射到等级 1-10
        level = int(ability * self.ability_levels) + 1
        return min(level, self.ability_levels)
    
    def _get_ability_level(self, level_score: int) -> AbilityLevel:
        """获取能力等级"""
        if level_score <= 2:
            return AbilityLevel.BEGINNER
        elif level_score <= 4:
            return AbilityLevel.ELEMENTARY
        elif level_score <= 6:
            return AbilityLevel.INTERMEDIATE
        elif level_score <= 8:
            return AbilityLevel.ADVANCED
        else:
            return AbilityLevel.EXPERT
    
    def _calculate_confidence(
        self, 
        performances: List[QuestionPerformance]
    ) -> float:
        """计算置信度"""
        # 基于样本数量和一致性计算置信度
        n = len(performances)
        
        # 样本数量因子
        size_factor = min(1, n / 20)
        
        # 一致性因子（标准差越小，置信度越高）
        scores = [1 if p.is_correct else 0 for p in performances]
        if len(scores) > 1:
            consistency = 1 - np.std(scores)
        else:
            consistency = 0.5
        
        confidence = 0.6 * size_factor + 0.4 * consistency
        return float(np.clip(confidence, 0.1, 1))
    
    def _calculate_knowledge_abilities(
        self,
        performances: List[QuestionPerformance]
    ) -> Dict[str, float]:
        """计算各知识点能力"""
        
        kp_performances = defaultdict(list)
        for perf in performances:
            kp_performances[perf.knowledge_point_id].append(perf)
        
        kp_abilities = {}
        for kp_id, perfs in kp_performances.items():
            correct_rate = sum(1 for p in perfs if p.is_correct) / len(perfs)
            avg_difficulty = np.mean([p.difficulty for p in perfs])
            
            # 综合考虑正确率和难度
            ability = correct_rate * (0.5 + 0.5 * avg_difficulty)
            kp_abilities[kp_id] = round(ability, 3)
        
        return kp_abilities
    
    def _generate_suggestions(
        self,
        ability_value: float,
        knowledge_abilities: Dict[str, float]
    ) -> List[str]:
        """生成提升建议"""
        suggestions = []
        
        if ability_value < 0.3:
            suggestions.append("建议从基础知识点开始系统学习")
            suggestions.append("多做基础练习题，建立知识框架")
        elif ability_value < 0.5:
            suggestions.append("基础已初步建立，建议增加练习量")
            suggestions.append("注意总结错题，找出薄弱环节")
        elif ability_value < 0.7:
            suggestions.append("能力良好，可以挑战中等偏难题目")
            suggestions.append("注重解题方法和技巧的提升")
        else:
            suggestions.append("能力优秀，建议挑战高难度题目")
            suggestions.append("可以尝试拓展学习，提升综合应用能力")
        
        # 针对薄弱知识点的建议
        weak_kps = [kp for kp, ability in knowledge_abilities.items() if ability < 0.5]
        if weak_kps:
            suggestions.append(f"重点加强以下知识点: {', '.join(weak_kps[:3])}")
        
        return suggestions
    
    def _estimate_time_to_next_level(
        self,
        ability_value: float,
        level_score: int,
        performances: List[QuestionPerformance]
    ) -> int:
        """预估升级所需时间（小时）"""
        
        # 到下一等级需要的提升
        next_level_threshold = (level_score + 1) / 10
        gap = next_level_threshold - ability_value
        
        if gap <= 0:
            return 0  # 已经可以升级
        
        # 基于当前学习效率估算
        if performances:
            avg_time_per_question = np.mean([p.time_spent_seconds for p in performances])
            correct_rate = sum(1 for p in performances if p.is_correct) / len(performances)
            
            # 假设每提升0.1需要解决约20道题
            questions_needed = gap * 200
            time_hours = questions_needed * avg_time_per_question / 3600
            
            # 考虑正确率调整
            if correct_rate > 0.7:
                time_hours *= 0.8
            elif correct_rate < 0.5:
                time_hours *= 1.5
            
            return int(max(1, time_hours))
        
        return int(gap * 50)  # 默认估算
