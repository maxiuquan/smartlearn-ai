import { ApiProperty } from '@nestjs/swagger';
import { PlanStatus, DailyPlanStatus } from '@prisma/client';

export class StudyPlanResponseDto {
  @ApiProperty({ description: '计划ID' })
  id: string;

  @ApiProperty({ description: '考试类型' })
  examType: string;

  @ApiProperty({ description: '考试日期' })
  examDate: Date;

  @ApiProperty({ description: '目标分数', nullable: true })
  targetScore: number | null;

  @ApiProperty({ description: '学科时间分配' })
  subjectPlan: Record<string, number>;

  @ApiProperty({ description: '状态', enum: PlanStatus })
  status: PlanStatus;

  @ApiProperty({ description: '剩余天数' })
  remainingDays: number;

  @ApiProperty({ description: '总任务数' })
  totalTasks: number;

  @ApiProperty({ description: '已完成任务数' })
  completedTasks: number;

  @ApiProperty({ description: '完成进度' })
  progress: number;
}

export class DailyPlanResponseDto {
  @ApiProperty({ description: '计划ID' })
  id: string;

  @ApiProperty({ description: '日期' })
  date: Date;

  @ApiProperty({ description: '当日任务列表' })
  tasks: any[];

  @ApiProperty({ description: '已完成任务数' })
  completedTasks: number;

  @ApiProperty({ description: '总任务数' })
  totalTasks: number;

  @ApiProperty({ description: '学习时长(分钟)' })
  studyTime: number;

  @ApiProperty({ description: '状态', enum: DailyPlanStatus })
  status: DailyPlanStatus;

  @ApiProperty({ description: '完成进度' })
  progress: number;
}

export class PlanOverviewDto {
  @ApiProperty({ description: '计划信息', type: StudyPlanResponseDto })
  plan: StudyPlanResponseDto;

  @ApiProperty({ description: '今日计划', type: DailyPlanResponseDto, nullable: true })
  todayPlan: DailyPlanResponseDto | null;

  @ApiProperty({ description: '本周学习时长(分钟)' })
  weeklyStudyTime: number;

  @ApiProperty({ description: '本周完成任务数' })
  weeklyCompletedTasks: number;
}

export class ScheduleSuggestionDto {
  @ApiProperty({ description: '学科' })
  subject: string;

  @ApiProperty({ description: '建议时长(分钟)' })
  duration: number;

  @ApiProperty({ description: '建议内容' })
  content: string;

  @ApiProperty({ description: '优先级' })
  priority: number;
}
