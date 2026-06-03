"""
智能批改服务
答案批改、错误分析
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime
from collections import defaultdict
import re
import difflib

from config import settings
from models.grading import (
    GradingRequest,
    GradingResponse,
    BatchGradingRequest,
    BatchGradingResponse,
    ErrorAnalysisRequest,
    ErrorAnalysisResponse,
    AnswerAnalysis,
    StepAnalysis,
    ErrorType,
    ErrorPattern,
    QuestionType
)


class GradingService:
    """智能批改服务"""
    
    def __init__(self):
        # 错误类型关键词映射
        self.error_keywords = {
            ErrorType.CALCULATION: ["计算", "运算", "结果", "数值"],
            ErrorType.CONCEPT: ["概念", "定义", "理解", "原理"],
            ErrorType.CARELESS: ["粗心", "马虎", "漏看", "抄错"],
            ErrorType.LOGIC: ["逻辑", "推理", "步骤", "顺序"],
            ErrorType.METHOD: ["方法", "解法", "思路", "技巧"],
            ErrorType.SYNTAX: ["语法", "格式", "表达", "书写"],
        }
    
    async def grade(self, request: GradingRequest) -> GradingResponse:
        """批改单个答案"""
        
        # 根据题目类型选择批改策略
        if request.question_type == QuestionType.CHOICE:
            analysis = await self._grade_choice(request)
        elif request.question_type == QuestionType.FILL:
            analysis = await self._grade_fill(request)
        elif request.question_type == QuestionType.CALCULATION:
            analysis, step_analysis = await self._grade_calculation(request)
        elif request.question_type == QuestionType.SHORT_ANSWER:
            analysis = await self._grade_short_answer(request)
        else:
            analysis = await self._grade_general(request)
        
        # 计算得分
        scoring_rules = request.scoring_rules or {"total": 100}
        max_score = scoring_rules.get("total", 100)
        total_score = analysis.score * max_score
        
        # 生成反馈
        feedback = self._generate_feedback(analysis)
        
        # 设置步骤分析（如果有）
        step_analysis = None
        if request.question_type == QuestionType.CALCULATION:
            _, step_analysis = await self._grade_calculation(request)
        
        return GradingResponse(
            question_id=request.question_id,
            analysis=analysis,
            step_analysis=step_analysis,
            total_score=total_score,
            max_score=max_score,
            score_percentage=analysis.score * 100,
            feedback=feedback,
            graded_at=datetime.now()
        )
    
    async def batch_grade(
        self,
        request: BatchGradingRequest
    ) -> BatchGradingResponse:
        """批量批改"""
        
        results = []
        error_stats = defaultdict(int)
        
        for answer in request.answers:
            result = await self.grade(answer)
            results.append(result)
            
            # 统计错误类型
            if not result.analysis.is_correct and result.analysis.error_type:
                error_stats[result.analysis.error_type] += 1
        
        # 计算总体统计
        total_score = sum(r.total_score for r in results)
        total_max = sum(r.max_score for r in results)
        accuracy = sum(1 for r in results if r.analysis.is_correct) / len(results)
        
        # 生成整体建议
        suggestions = self._generate_batch_suggestions(results, error_stats)
        
        return BatchGradingResponse(
            user_id=request.user_id,
            results=results,
            total_score=total_score,
            total_max_score=total_max,
            accuracy_rate=round(accuracy, 3),
            error_statistics=dict(error_stats),
            suggestions=suggestions
        )
    
    async def analyze_errors(
        self,
        request: ErrorAnalysisRequest
    ) -> ErrorAnalysisResponse:
        """分析错误模式"""
        
        # 统计错误类型
        error_counts = defaultdict(int)
        error_kps = defaultdict(list)
        error_examples = defaultdict(list)
        
        for grading in request.recent_gradings:
            if not grading.analysis.is_correct and grading.analysis.error_type:
                error_type = grading.analysis.error_type
                error_counts[error_type] += 1
                
                # 记录相关知识点和示例
                if grading.analysis.error_description:
                    error_examples[error_type].append(grading.analysis.error_description)
        
        # 构建错误模式
        error_patterns = []
        for error_type, count in sorted(error_counts.items(), key=lambda x: -x[1]):
            error_patterns.append(ErrorPattern(
                error_type=error_type,
                frequency=count,
                knowledge_points=list(set(error_kps[error_type]))[:5],
                examples=error_examples[error_type][:3]
            ))
        
        # 找出薄弱知识点
        weak_kps = self._identify_weak_knowledge_points(request.recent_gradings)
        
        # 生成改进计划
        improvement_plan = self._create_improvement_plan(error_patterns, weak_kps)
        
        # 确定优先处理顺序
        priority_order = self._determine_priority(error_patterns, weak_kps)
        
        return ErrorAnalysisResponse(
            user_id=request.user_id,
            error_patterns=error_patterns,
            weak_knowledge_points=weak_kps,
            improvement_plan=improvement_plan,
            priority_order=priority_order
        )
    
    async def _grade_choice(self, request: GradingRequest) -> AnswerAnalysis:
        """批改选择题"""
        is_correct = request.user_answer.strip().upper() == request.standard_answer.strip().upper()
        
        return AnswerAnalysis(
            is_correct=is_correct,
            score=1.0 if is_correct else 0.0,
            error_type=None if is_correct else ErrorType.CARELESS,
            error_description=None if is_correct else "选项选择错误",
            correct_answer=request.standard_answer,
            user_answer=request.user_answer,
            key_points=[],
            missed_points=[],
            suggestions=[] if is_correct else ["请仔细审题，理解每个选项的含义"]
        )
    
    async def _grade_fill(self, request: GradingRequest) -> AnswerAnalysis:
        """批改填空题"""
        # 标准化答案进行比较
        user_normalized = self._normalize_answer(request.user_answer)
        standard_normalized = self._normalize_answer(request.standard_answer)
        
        # 计算相似度
        similarity = difflib.SequenceMatcher(
            None, 
            user_normalized, 
            standard_normalized
        ).ratio()
        
        is_correct = similarity >= 0.95
        score = similarity if not is_correct else 1.0
        
        # 确定错误类型
        error_type = None
        error_desc = None
        if not is_correct:
            if similarity >= 0.7:
                error_type = ErrorType.CARELESS
                error_desc = "答案接近正确，可能存在书写或计算小错误"
            else:
                error_type = ErrorType.CONCEPT
                error_desc = "答案与正确答案差异较大，需检查理解"
        
        return AnswerAnalysis(
            is_correct=is_correct,
            score=round(score, 3),
            error_type=error_type,
            error_description=error_desc,
            correct_answer=request.standard_answer,
            user_answer=request.user_answer,
            key_points=self._extract_key_points(request.standard_answer),
            missed_points=self._find_missed_points(user_normalized, standard_normalized),
            suggestions=self._generate_fill_suggestions(is_correct, similarity)
        )
    
    async def _grade_calculation(
        self, 
        request: GradingRequest
    ) -> tuple[AnswerAnalysis, List[StepAnalysis]]:
        """批改计算题"""
        
        # 解析步骤
        user_steps = self._parse_steps(request.user_answer)
        standard_steps = self._parse_steps(request.standard_answer)
        
        # 逐步比较
        step_analyses = []
        correct_steps = 0
        
        for i, (user_step, standard_step) in enumerate(
            zip(user_steps, standard_steps)
        ):
            step_similarity = difflib.SequenceMatcher(
                None,
                self._normalize_answer(user_step),
                self._normalize_answer(standard_step)
            ).ratio()
            
            is_step_correct = step_similarity >= 0.9
            if is_step_correct:
                correct_steps += 1
            
            step_analyses.append(StepAnalysis(
                step_number=i + 1,
                content=user_step,
                is_correct=is_step_correct,
                score=step_similarity,
                error=None if is_step_correct else f"步骤{i+1}有误",
                correction=None if is_step_correct else standard_step
            ))
        
        # 计算总分
        if len(standard_steps) > 0:
            overall_score = correct_steps / len(standard_steps)
        else:
            overall_score = 0.5
        
        is_correct = overall_score >= 0.9
        
        # 确定错误类型
        error_type = None
        if not is_correct:
            # 找出第一个错误步骤
            for sa in step_analyses:
                if not sa.is_correct:
                    if sa.step_number == len(step_analyses):
                        error_type = ErrorType.CALCULATION
                    else:
                        error_type = ErrorType.METHOD
                    break
        
        analysis = AnswerAnalysis(
            is_correct=is_correct,
            score=round(overall_score, 3),
            error_type=error_type,
            error_description=f"共{len(standard_steps)}步，正确{correct_steps}步" if not is_correct else None,
            correct_answer=request.standard_answer,
            user_answer=request.user_answer,
            key_points=[f"步骤{i+1}" for i in range(len(standard_steps))],
            missed_points=[f"步骤{sa.step_number}" for sa in step_analyses if not sa.is_correct],
            suggestions=self._generate_calculation_suggestions(step_analyses)
        )
        
        return analysis, step_analyses
    
    async def _grade_short_answer(self, request: GradingRequest) -> AnswerAnalysis:
        """批改简答题"""
        
        # 提取关键词
        standard_keywords = self._extract_keywords(request.standard_answer)
        user_keywords = self._extract_keywords(request.user_answer)
        
        # 计算关键词覆盖率
        if standard_keywords:
            covered = sum(1 for k in standard_keywords if k in user_keywords)
            coverage = covered / len(standard_keywords)
        else:
            coverage = 0.5
        
        # 计算文本相似度
        similarity = difflib.SequenceMatcher(
            None,
            self._normalize_answer(request.user_answer),
            self._normalize_answer(request.standard_answer)
        ).ratio()
        
        # 综合评分
        score = 0.6 * coverage + 0.4 * similarity
        is_correct = score >= 0.8
        
        # 找出遗漏的关键点
        missed = [k for k in standard_keywords if k not in user_keywords]
        
        return AnswerAnalysis(
            is_correct=is_correct,
            score=round(score, 3),
            error_type=None if is_correct else ErrorType.INCOMPLETE,
            error_description="回答不完整" if missed else None,
            correct_answer=request.standard_answer,
            user_answer=request.user_answer,
            key_points=standard_keywords,
            missed_points=missed,
            suggestions=self._generate_short_answer_suggestions(is_correct, missed)
        )
    
    async def _grade_general(self, request: GradingRequest) -> AnswerAnalysis:
        """通用批改"""
        similarity = difflib.SequenceMatcher(
            None,
            self._normalize_answer(request.user_answer),
            self._normalize_answer(request.standard_answer)
        ).ratio()
        
        is_correct = similarity >= 0.9
        
        return AnswerAnalysis(
            is_correct=is_correct,
            score=round(similarity, 3),
            error_type=None if is_correct else ErrorType.OTHER,
            error_description=None,
            correct_answer=request.standard_answer,
            user_answer=request.user_answer,
            key_points=[],
            missed_points=[],
            suggestions=[]
        )
    
    def _normalize_answer(self, answer: str) -> str:
        """标准化答案"""
        # 去除空格、标点等
        normalized = re.sub(r'[\s\u3000，。、；：""''！？（）【】]', '', answer)
        return normalized.lower()
    
    def _extract_key_points(self, answer: str) -> List[str]:
        """提取关键点"""
        # 简单实现：按分号或句号分割
        points = re.split(r'[；;。]', answer)
        return [p.strip() for p in points if p.strip()]
    
    def _find_missed_points(
        self, 
        user: str, 
        standard: str
    ) -> List[str]:
        """找出遗漏的点"""
        missed = []
        # 找出标准答案中有但用户答案中没有的部分
        for i in range(len(standard) - 2):
            segment = standard[i:i+3]
            if segment not in user and segment not in missed:
                missed.append(segment)
        return missed[:5]  # 最多返回5个
    
    def _parse_steps(self, answer: str) -> List[str]:
        """解析计算步骤"""
        # 按换行或步骤标记分割
        steps = re.split(r'\n|步骤\d+[：:.]|①|②|③|④|⑤', answer)
        return [s.strip() for s in steps if s.strip()]
    
    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词"""
        # 简单实现：提取2-4字的词组
        keywords = []
        for length in [4, 3, 2]:
            for i in range(len(text) - length + 1):
                word = text[i:i+length]
                if not re.match(r'^[\s\u3000，。、；：""''！？（）【】0-9]+$', word):
                    keywords.append(word)
        
        # 去重并返回
        return list(set(keywords))[:10]
    
    def _generate_feedback(self, analysis: AnswerAnalysis) -> str:
        """生成反馈"""
        if analysis.is_correct:
            return "回答正确！继续保持！"
        
        feedback_parts = []
        
        if analysis.error_type:
            feedback_parts.append(f"错误类型：{analysis.error_type.value}")
        
        if analysis.error_description:
            feedback_parts.append(analysis.error_description)
        
        if analysis.missed_points:
            feedback_parts.append(f"遗漏要点：{', '.join(analysis.missed_points[:3])}")
        
        if analysis.suggestions:
            feedback_parts.append(analysis.suggestions[0])
        
        return " | ".join(feedback_parts) if feedback_parts else "请参考正确答案进行订正"
    
    def _generate_fill_suggestions(
        self, 
        is_correct: bool, 
        similarity: float
    ) -> List[str]:
        """生成填空题建议"""
        if is_correct:
            return []
        
        if similarity >= 0.7:
            return ["答案接近正确，请检查细节"]
        else:
            return ["请重新理解题目要求", "注意答案的准确性"]
    
    def _generate_calculation_suggestions(
        self, 
        step_analyses: List[StepAnalysis]
    ) -> List[str]:
        """生成计算题建议"""
        suggestions = []
        
        wrong_steps = [sa for sa in step_analyses if not sa.is_correct]
        
        if not wrong_steps:
            return []
        
        suggestions.append(f"注意步骤{wrong_steps[0].step_number}的计算")
        
        if len(wrong_steps) > 1:
            suggestions.append("建议逐步检查计算过程")
        
        return suggestions
    
    def _generate_short_answer_suggestions(
        self,
        is_correct: bool,
        missed: List[str]
    ) -> List[str]:
        """生成简答题建议"""
        if is_correct:
            return []
        
        suggestions = ["回答需要更加完整"]
        
        if missed:
            suggestions.append(f"建议补充：{', '.join(missed[:2])}")
        
        return suggestions
    
    def _generate_batch_suggestions(
        self,
        results: List[GradingResponse],
        error_stats: Dict[ErrorType, int]
    ) -> List[str]:
        """生成批量批改建议"""
        suggestions = []
        
        # 正确率建议
        correct_count = sum(1 for r in results if r.analysis.is_correct)
        accuracy = correct_count / len(results) if results else 0
        
        if accuracy >= 0.9:
            suggestions.append("表现优秀！继续保持！")
        elif accuracy >= 0.7:
            suggestions.append("表现良好，还有提升空间")
        else:
            suggestions.append("需要加强练习，重点攻克薄弱知识点")
        
        # 错误类型建议
        if error_stats:
            most_common = max(error_stats.items(), key=lambda x: x[1])
            suggestions.append(f"主要问题：{most_common[0].value}，建议针对性练习")
        
        return suggestions
    
    def _identify_weak_knowledge_points(
        self,
        gradings: List[GradingResponse]
    ) -> List[str]:
        """识别薄弱知识点"""
        kp_errors = defaultdict(int)
        
        for grading in gradings:
            if not grading.analysis.is_correct:
                # 简化处理，使用问题ID作为知识点标识
                kp_errors[grading.question_id] += 1
        
        # 返回错误最多的知识点
        sorted_kps = sorted(kp_errors.items(), key=lambda x: -x[1])
        return [kp for kp, _ in sorted_kps[:5]]
    
    def _create_improvement_plan(
        self,
        error_patterns: List[ErrorPattern],
        weak_kps: List[str]
    ) -> List[str]:
        """创建改进计划"""
        plan = []
        
        for pattern in error_patterns[:3]:
            if pattern.error_type == ErrorType.CALCULATION:
                plan.append("加强计算练习，注意运算准确性")
            elif pattern.error_type == ErrorType.CONCEPT:
                plan.append("复习相关概念，加深理解")
            elif pattern.error_type == ErrorType.CARELESS:
                plan.append("做题时更加细心，注意审题")
            elif pattern.error_type == ErrorType.METHOD:
                plan.append("学习更多解题方法，拓宽思路")
        
        if weak_kps:
            plan.append(f"重点复习：{', '.join(weak_kps[:3])}")
        
        return plan
    
    def _determine_priority(
        self,
        error_patterns: List[ErrorPattern],
        weak_kps: List[str]
    ) -> List[str]:
        """确定优先处理顺序"""
        priority = []
        
        # 错误频率高的优先
        for pattern in error_patterns:
            priority.append(f"解决{pattern.error_type.value}问题")
        
        # 薄弱知识点优先
        priority.extend(weak_kps[:3])
        
        return priority
