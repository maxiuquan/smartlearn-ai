"""
手写识别服务
OCR识别接口（模拟实现）
"""
import numpy as np
from typing import List, Optional, Dict
from datetime import datetime
import uuid
import base64
import re

from config import settings
from models.handwriting import (
    HandwritingRequest,
    HandwritingResponse,
    RealtimeRecognitionRequest,
    RealtimeRecognitionResponse,
    RecognizedLine,
    RecognizedCharacter,
    ContentType
)


class HandwritingService:
    """手写识别服务（模拟实现）"""
    
    def __init__(self):
        # 模拟的识别结果库
        self._mock_results: Dict[str, str] = {}
    
    async def recognize(
        self,
        request: HandwritingRequest
    ) -> HandwritingResponse:
        """识别手写内容"""
        
        start_time = datetime.now()
        
        # 模拟识别过程
        if request.image_base64:
            # 解码图片（模拟）
            text, lines = await self._process_image(
                request.image_base64,
                request.content_type,
                request.language
            )
        elif request.image_url:
            # 从URL获取图片（模拟）
            text, lines = await self._process_url(
                request.image_url,
                request.content_type
            )
        else:
            text = ""
            lines = []
        
        # 计算处理时间
        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # 检测数学表达式
        math_expressions = self._detect_math_expressions(text)
        
        # 确定内容类型
        detected_type = self._detect_content_type(text, math_expressions)
        
        # 计算整体置信度
        overall_confidence = self._calculate_overall_confidence(lines)
        
        return HandwritingResponse(
            text=text,
            lines=lines,
            overall_confidence=overall_confidence,
            content_type=detected_type,
            math_expressions=math_expressions,
            processing_time_ms=processing_time,
            metadata={
                "language": request.language,
                "enable_math_detection": request.enable_math_detection
            }
        )
    
    async def realtime_recognize(
        self,
        request: RealtimeRecognitionRequest
    ) -> RealtimeRecognitionResponse:
        """实时识别"""
        
        # 基于笔画进行识别
        text, candidates = await self._recognize_strokes(
            request.strokes,
            request.language
        )
        
        # 结合之前的文本
        if request.previous_text:
            text = request.previous_text + text
        
        # 判断是否完整字符
        is_complete = len(text) > 0 and self._is_complete_character(text[-1])
        
        # 计算置信度
        confidence = 0.85 + np.random.uniform(-0.1, 0.1)
        
        return RealtimeRecognitionResponse(
            text=text,
            candidates=candidates,
            confidence=round(confidence, 3),
            is_complete=is_complete
        )
    
    async def _process_image(
        self,
        image_base64: str,
        content_type: ContentType,
        language: str
    ) -> tuple[str, List[RecognizedLine]]:
        """处理图片（模拟）"""
        
        # 模拟识别结果
        mock_texts = {
            ContentType.TEXT: "这是一段手写文字的识别结果。",
            ContentType.MATH: "x² + 2x + 1 = 0",
            ContentType.ENGLISH: "Hello, this is handwritten text.",
            ContentType.CHINESE: "学习使人进步",
            ContentType.MIXED: "方程 x² + y² = r² 表示圆"
        }
        
        text = mock_texts.get(content_type, mock_texts[ContentType.TEXT])
        
        # 生成模拟的识别行
        lines = self._generate_mock_lines(text, language)
        
        return text, lines
    
    async def _process_url(
        self,
        image_url: str,
        content_type: ContentType
    ) -> tuple[str, List[RecognizedLine]]:
        """处理URL图片（模拟）"""
        
        # 模拟识别
        text = "从URL识别的文字内容"
        lines = self._generate_mock_lines(text, "zh")
        
        return text, lines
    
    async def _recognize_strokes(
        self,
        strokes: List,
        language: str
    ) -> tuple[str, List[str]]:
        """识别笔画（模拟）"""
        
        # 模拟识别结果
        if language == "zh":
            characters = ["学", "习", "进", "步", "天", "地", "人", "和"]
        else:
            characters = ["a", "b", "c", "d", "e", "f", "g", "h"]
        
        # 随机选择一个字符
        main_char = np.random.choice(characters)
        
        # 生成候选字符
        candidates = [main_char]
        remaining = [c for c in characters if c != main_char]
        candidates.extend(np.random.choice(remaining, size=min(3, len(remaining)), replace=False).tolist())
        
        return main_char, candidates
    
    def _generate_mock_lines(
        self,
        text: str,
        language: str
    ) -> List[RecognizedLine]:
        """生成模拟识别行"""
        
        lines = []
        # 简单分行
        words = text.split()
        if len(words) == 0:
            words = [text]
        
        y_pos = 0
        for i, word in enumerate(words):
            characters = []
            x_pos = 0
            
            for char in word:
                confidence = 0.9 + np.random.uniform(-0.1, 0.05)
                characters.append(RecognizedCharacter(
                    character=char,
                    confidence=round(confidence, 3),
                    position=(x_pos, y_pos, 20, 30),
                    alternatives=[]
                ))
                x_pos += 25
            
            line_confidence = np.mean([c.confidence for c in characters])
            lines.append(RecognizedLine(
                text=word,
                confidence=round(line_confidence, 3),
                characters=characters,
                position=(0, y_pos, x_pos, 30)
            ))
            y_pos += 40
        
        return lines
    
    def _detect_math_expressions(self, text: str) -> List[str]:
        """检测数学表达式"""
        # 简单的数学表达式检测
        patterns = [
            r'[a-z]\²\+[^=]+=\d+',  # x² + ... = 0
            r'\d+[+\-*/]\d+',  # 简单运算
            r'[a-z]\s*=\s*[^,，]+',  # 变量赋值
            r'\([^)]+\)[+\-*/]',  # 括号表达式
        ]
        
        expressions = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            expressions.extend(matches)
        
        return expressions
    
    def _detect_content_type(
        self,
        text: str,
        math_expressions: List[str]
    ) -> ContentType:
        """检测内容类型"""
        
        if math_expressions:
            return ContentType.MATH
        
        # 检测是否包含中文
        has_chinese = bool(re.search(r'[\u4e00-\u9fff]', text))
        # 检测是否包含英文
        has_english = bool(re.search(r'[a-zA-Z]', text))
        
        if has_chinese and has_english:
            return ContentType.MIXED
        elif has_chinese:
            return ContentType.CHINESE
        elif has_english:
            return ContentType.ENGLISH
        else:
            return ContentType.TEXT
    
    def _calculate_overall_confidence(
        self,
        lines: List[RecognizedLine]
    ) -> float:
        """计算整体置信度"""
        if not lines:
            return 0.0
        
        confidences = [line.confidence for line in lines]
        return round(float(np.mean(confidences)), 3)
    
    def _is_complete_character(self, char: str) -> bool:
        """判断是否完整字符"""
        # 简单判断：中文字符通常需要多笔画
        if '\u4e00' <= char <= '\u9fff':
            # 中文，随机判断
            return np.random.random() > 0.3
        else:
            # 英文，通常是单笔画
            return True
