"""
知识图谱服务
知识点依赖关系图
"""
import numpy as np
from typing import List, Optional, Dict, Set
from datetime import datetime
from collections import defaultdict, deque
import uuid

from config import settings
from models.knowledge_graph import (
    KnowledgeNode,
    KnowledgeGraph,
    KnowledgeRelation,
    KnowledgeGraphRequest,
    KnowledgeGraphResponse,
    KnowledgeDifficulty,
    RelationType,
    PrerequisiteRequest,
    PrerequisiteResponse,
    PrerequisitePath
)


class KnowledgeGraphService:
    """知识图谱服务"""
    
    def __init__(self):
        self.max_depth = settings.MAX_PREREQUISITE_DEPTH
        # 模拟知识图谱数据
        self._graph_cache: Dict[str, KnowledgeGraph] = {}
    
    async def get_knowledge_graph(
        self,
        request: KnowledgeGraphRequest
    ) -> KnowledgeGraphResponse:
        """获取知识图谱"""
        
        # 获取或构建知识图谱
        subject = request.subject or "math"
        graph = await self._build_or_get_graph(subject)
        
        # 如果指定了知识点，过滤相关节点
        if request.knowledge_point_id:
            graph = self._filter_graph_by_knowledge(
                graph,
                request.knowledge_point_id,
                request.depth
            )
        
        return KnowledgeGraphResponse(
            graph=graph,
            total_nodes=len(graph.nodes),
            total_relations=len(graph.relations),
            generated_at=datetime.now()
        )
    
    async def get_prerequisites(
        self,
        request: PrerequisiteRequest
    ) -> PrerequisiteResponse:
        """获取前置知识点"""
        
        # 获取知识图谱
        graph = await self._build_or_get_graph("math")
        
        # 构建邻接表
        adjacency = self._build_adjacency(graph)
        
        # BFS查找所有前置知识
        prerequisites = self._find_all_prerequisites(
            request.knowledge_point_id,
            adjacency,
            graph,
            request.max_depth
        )
        
        # 确定缺失的前置知识
        user_learned = set(request.user_learned or [])
        missing = [p for p in prerequisites if p not in user_learned]
        
        # 生成学习顺序
        learning_order = self._topological_sort(
            missing,
            adjacency,
            graph
        )
        
        # 计算总学习时间
        total_time = sum(
            self._get_node_time(kp_id, graph)
            for kp_id in learning_order
        )
        
        # 构建前置路径
        prerequisite_paths = self._build_prerequisite_paths(
            request.knowledge_point_id,
            learning_order,
            graph
        )
        
        return PrerequisiteResponse(
            target_id=request.knowledge_point_id,
            prerequisites=prerequisite_paths,
            missing_prerequisites=missing,
            learning_order=learning_order,
            total_time_minutes=total_time
        )
    
    async def _build_or_get_graph(self, subject: str) -> KnowledgeGraph:
        """构建或获取知识图谱"""
        
        if subject in self._graph_cache:
            return self._graph_cache[subject]
        
        # 构建模拟知识图谱
        graph = self._build_mock_graph(subject)
        self._graph_cache[subject] = graph
        
        return graph
    
    def _build_mock_graph(self, subject: str) -> KnowledgeGraph:
        """构建模拟知识图谱"""
        
        # 数学知识图谱示例
        nodes = [
            KnowledgeNode(
                id="kp_1",
                name="自然数",
                subject="math",
                chapter="第一章",
                difficulty=KnowledgeDifficulty.BASIC,
                description="自然数的概念和性质",
                keywords=["自然数", "整数", "计数"],
                importance=0.9,
                estimated_time_minutes=30
            ),
            KnowledgeNode(
                id="kp_2",
                name="加法运算",
                subject="math",
                chapter="第一章",
                difficulty=KnowledgeDifficulty.BASIC,
                description="加法的基本概念和运算规则",
                keywords=["加法", "运算", "求和"],
                importance=0.95,
                estimated_time_minutes=45
            ),
            KnowledgeNode(
                id="kp_3",
                name="减法运算",
                subject="math",
                chapter="第一章",
                difficulty=KnowledgeDifficulty.BASIC,
                description="减法的基本概念和运算规则",
                keywords=["减法", "运算", "差"],
                importance=0.9,
                estimated_time_minutes=45
            ),
            KnowledgeNode(
                id="kp_4",
                name="乘法运算",
                subject="math",
                chapter="第二章",
                difficulty=KnowledgeDifficulty.INTERMEDIATE,
                description="乘法的基本概念和运算规则",
                keywords=["乘法", "运算", "积"],
                importance=0.95,
                estimated_time_minutes=60
            ),
            KnowledgeNode(
                id="kp_5",
                name="除法运算",
                subject="math",
                chapter="第二章",
                difficulty=KnowledgeDifficulty.INTERMEDIATE,
                description="除法的基本概念和运算规则",
                keywords=["除法", "运算", "商"],
                importance=0.9,
                estimated_time_minutes=60
            ),
            KnowledgeNode(
                id="kp_6",
                name="分数",
                subject="math",
                chapter="第三章",
                difficulty=KnowledgeDifficulty.INTERMEDIATE,
                description="分数的概念和运算",
                keywords=["分数", "分子", "分母"],
                importance=0.85,
                estimated_time_minutes=90
            ),
            KnowledgeNode(
                id="kp_7",
                name="小数",
                subject="math",
                chapter="第三章",
                difficulty=KnowledgeDifficulty.INTERMEDIATE,
                description="小数的概念和运算",
                keywords=["小数", "小数点"],
                importance=0.85,
                estimated_time_minutes=60
            ),
            KnowledgeNode(
                id="kp_8",
                name="方程",
                subject="math",
                chapter="第四章",
                difficulty=KnowledgeDifficulty.ADVANCED,
                description="方程的概念和解法",
                keywords=["方程", "未知数", "解"],
                importance=0.95,
                estimated_time_minutes=120
            ),
            KnowledgeNode(
                id="kp_9",
                name="不等式",
                subject="math",
                chapter="第四章",
                difficulty=KnowledgeDifficulty.ADVANCED,
                description="不等式的概念和解法",
                keywords=["不等式", "解集"],
                importance=0.8,
                estimated_time_minutes=90
            ),
            KnowledgeNode(
                id="kp_10",
                name="函数",
                subject="math",
                chapter="第五章",
                difficulty=KnowledgeDifficulty.EXPERT,
                description="函数的概念和性质",
                keywords=["函数", "定义域", "值域"],
                importance=1.0,
                estimated_time_minutes=150
            ),
        ]
        
        relations = [
            # 加法依赖自然数
            KnowledgeRelation(
                source_id="kp_2",
                target_id="kp_1",
                relation_type=RelationType.PREREQUISITE,
                strength=1.0
            ),
            # 减法依赖加法
            KnowledgeRelation(
                source_id="kp_3",
                target_id="kp_2",
                relation_type=RelationType.PREREQUISITE,
                strength=0.9
            ),
            # 乘法依赖加法
            KnowledgeRelation(
                source_id="kp_4",
                target_id="kp_2",
                relation_type=RelationType.PREREQUISITE,
                strength=1.0
            ),
            # 除法依赖乘法
            KnowledgeRelation(
                source_id="kp_5",
                target_id="kp_4",
                relation_type=RelationType.PREREQUISITE,
                strength=1.0
            ),
            # 分数依赖除法
            KnowledgeRelation(
                source_id="kp_6",
                target_id="kp_5",
                relation_type=RelationType.PREREQUISITE,
                strength=0.9
            ),
            # 小数依赖分数
            KnowledgeRelation(
                source_id="kp_7",
                target_id="kp_6",
                relation_type=RelationType.RELATED,
                strength=0.7
            ),
            # 方程依赖四则运算
            KnowledgeRelation(
                source_id="kp_8",
                target_id="kp_4",
                relation_type=RelationType.PREREQUISITE,
                strength=0.8
            ),
            KnowledgeRelation(
                source_id="kp_8",
                target_id="kp_5",
                relation_type=RelationType.PREREQUISITE,
                strength=0.8
            ),
            # 不等式依赖方程
            KnowledgeRelation(
                source_id="kp_9",
                target_id="kp_8",
                relation_type=RelationType.PREREQUISITE,
                strength=0.9
            ),
            # 函数依赖方程
            KnowledgeRelation(
                source_id="kp_10",
                target_id="kp_8",
                relation_type=RelationType.PREREQUISITE,
                strength=1.0
            ),
        ]
        
        return KnowledgeGraph(
            nodes=nodes,
            relations=relations,
            subject=subject,
            version="1.0.0",
            updated_at=datetime.now()
        )
    
    def _build_adjacency(
        self, 
        graph: KnowledgeGraph
    ) -> Dict[str, List[str]]:
        """构建邻接表（前置关系）"""
        adjacency = defaultdict(list)
        
        for relation in graph.relations:
            if relation.relation_type == RelationType.PREREQUISITE:
                # source 依赖 target
                adjacency[relation.source_id].append(relation.target_id)
        
        return adjacency
    
    def _find_all_prerequisites(
        self,
        knowledge_id: str,
        adjacency: Dict[str, List[str]],
        graph: KnowledgeGraph,
        max_depth: int
    ) -> Set[str]:
        """查找所有前置知识点"""
        prerequisites = set()
        queue = deque([(knowledge_id, 0)])
        visited = set()
        
        while queue:
            current, depth = queue.popleft()
            
            if depth >= max_depth or current in visited:
                continue
            
            visited.add(current)
            
            for prereq in adjacency.get(current, []):
                prerequisites.add(prereq)
                queue.append((prereq, depth + 1))
        
        return prerequisites
    
    def _topological_sort(
        self,
        knowledge_ids: List[str],
        adjacency: Dict[str, List[str]],
        graph: KnowledgeGraph
    ) -> List[str]:
        """拓扑排序，生成学习顺序"""
        # 简化版拓扑排序
        in_degree = defaultdict(int)
        
        for kp_id in knowledge_ids:
            for prereq in adjacency.get(kp_id, []):
                if prereq in knowledge_ids:
                    in_degree[kp_id] += 1
        
        # 按入度排序
        result = []
        remaining = set(knowledge_ids)
        
        while remaining:
            # 找入度为0的节点
            zero_degree = [k for k in remaining if in_degree[k] == 0]
            
            if not zero_degree:
                # 有环，随机选一个
                zero_degree = [next(iter(remaining))]
            
            # 按重要性排序
            zero_degree.sort(
                key=lambda x: self._get_node_importance(x, graph),
                reverse=True
            )
            
            for node in zero_degree:
                result.append(node)
                remaining.remove(node)
                
                # 更新依赖此节点的其他节点的入度
                for kp_id in knowledge_ids:
                    if node in adjacency.get(kp_id, []):
                        in_degree[kp_id] -= 1
        
        return result
    
    def _get_node_time(
        self, 
        kp_id: str, 
        graph: KnowledgeGraph
    ) -> int:
        """获取节点学习时间"""
        for node in graph.nodes:
            if node.id == kp_id:
                return node.estimated_time_minutes
        return 30  # 默认
    
    def _get_node_importance(
        self, 
        kp_id: str, 
        graph: KnowledgeGraph
    ) -> float:
        """获取节点重要性"""
        for node in graph.nodes:
            if node.id == kp_id:
                return node.importance
        return 0.5
    
    def _build_prerequisite_paths(
        self,
        target_id: str,
        learning_order: List[str],
        graph: KnowledgeGraph
    ) -> List[PrerequisitePath]:
        """构建前置知识路径"""
        paths = []
        
        for i, kp_id in enumerate(learning_order):
            total_time = sum(
                self._get_node_time(k, graph)
                for k in learning_order[:i + 1]
            )
            
            paths.append(PrerequisitePath(
                target_id=target_id,
                path=learning_order[:i + 1],
                depth=i + 1,
                total_time_minutes=total_time,
                is_complete=(i == len(learning_order) - 1)
            ))
        
        return paths
    
    def _filter_graph_by_knowledge(
        self,
        graph: KnowledgeGraph,
        knowledge_id: str,
        depth: int
    ) -> KnowledgeGraph:
        """根据知识点过滤图谱"""
        # BFS找到相关节点
        related_nodes = set([knowledge_id])
        adjacency = self._build_adjacency(graph)
        
        # 反向邻接表
        reverse_adjacency = defaultdict(list)
        for k, v in adjacency.items():
            for prereq in v:
                reverse_adjacency[prereq].append(k)
        
        # BFS扩展
        queue = deque([(knowledge_id, 0)])
        while queue:
            current, d = queue.popleft()
            if d >= depth:
                continue
            
            # 前置知识
            for prereq in adjacency.get(current, []):
                if prereq not in related_nodes:
                    related_nodes.add(prereq)
                    queue.append((prereq, d + 1))
            
            # 后继知识
            for successor in reverse_adjacency.get(current, []):
                if successor not in related_nodes:
                    related_nodes.add(successor)
                    queue.append((successor, d + 1))
        
        # 过滤节点和关系
        filtered_nodes = [n for n in graph.nodes if n.id in related_nodes]
        filtered_relations = [
            r for r in graph.relations
            if r.source_id in related_nodes and r.target_id in related_nodes
        ]
        
        return KnowledgeGraph(
            nodes=filtered_nodes,
            relations=filtered_relations,
            subject=graph.subject,
            version=graph.version,
            updated_at=datetime.now()
        )
