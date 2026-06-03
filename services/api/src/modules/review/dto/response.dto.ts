import { ApiProperty } from '@nestjs/swagger';
import { ReviewType, ReviewStatus } from '@prisma/client';

export class ReviewTaskResponseDto {
  @ApiProperty({ description: '任务ID' })
  id: string;

  @ApiProperty({ description: '题目ID', nullable: true })
  questionId: string | null;

  @ApiProperty({ description: '知识点ID', nullable: true })
  knowledgeId: string | null;

  @ApiProperty({ description: '复习类型', enum: ReviewType })
  type: ReviewType;

  @ApiProperty({ description: '难度因子' })
  easeFactor: number;

  @ApiProperty({ description: '间隔天数' })
  interval: number;

  @ApiProperty({ description: '重复次数' })
  repetitions: number;

  @ApiProperty({ description: '下次复习时间' })
  nextReviewAt: Date;

  @ApiProperty({ description: '上次复习时间', nullable: true })
  lastReviewAt: Date | null;

  @ApiProperty({ description: '状态', enum: ReviewStatus })
  status: ReviewStatus;

  @ApiProperty({ description: '优先级' })
  priority: number;
}

export class ReviewStatsDto {
  @ApiProperty({ description: '待复习数' })
  pending: number;

  @ApiProperty({ description: '今日待复习' })
  today: number;

  @ApiProperty({ description: '已过期' })
  overdue: number;

  @ApiProperty({ description: '今日已完成' })
  completedToday: number;

  @ApiProperty({ description: '总完成数' })
  totalCompleted: number;
}

export class ForgettingCurveDto {
  @ApiProperty({ description: '天数' })
  day: number;

  @ApiProperty({ description: '记忆保持率' })
  retention: number;
}
