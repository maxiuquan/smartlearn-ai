import { ApiProperty } from '@nestjs/swagger';
import { LearningRecord, LearningMode } from '@prisma/client';

export class LearningRecordResponseDto {
  @ApiProperty({ description: '记录ID' })
  id: string;

  @ApiProperty({ description: '题目ID' })
  questionId: string;

  @ApiProperty({ description: '用户答案' })
  userAnswer: string;

  @ApiProperty({ description: '是否正确' })
  isCorrect: boolean;

  @ApiProperty({ description: '用时(秒)' })
  timeSpent: number;

  @ApiProperty({ description: '答题模式', enum: LearningMode })
  mode: LearningMode;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

export class LearningRecordListDto {
  @ApiProperty({ description: '记录列表', type: [LearningRecordResponseDto] })
  items: LearningRecordResponseDto[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '当前页' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;
}

export class LearningProgressDto {
  @ApiProperty({ description: '学科ID' })
  subjectId: string;

  @ApiProperty({ description: '学科名称' })
  subjectName: string;

  @ApiProperty({ description: '总答题数' })
  totalQuestions: number;

  @ApiProperty({ description: '正确数' })
  correctCount: number;

  @ApiProperty({ description: '正确率' })
  correctRate: number;

  @ApiProperty({ description: '总用时(分钟)' })
  totalTime: number;

  @ApiProperty({ description: '平均用时(秒)' })
  avgTime: number;
}

export class DailyStatsDto {
  @ApiProperty({ description: '日期' })
  date: string;

  @ApiProperty({ description: '答题数' })
  questionCount: number;

  @ApiProperty({ description: '正确数' })
  correctCount: number;

  @ApiProperty({ description: '正确率' })
  correctRate: number;

  @ApiProperty({ description: '学习时长(分钟)' })
  studyTime: number;
}
