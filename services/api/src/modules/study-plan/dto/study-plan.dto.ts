import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsDateString, IsJSON } from 'class-validator';
import { PlanStatus, DailyPlanStatus } from '@prisma/client';

export class CreateStudyPlanDto {
  @ApiProperty({ description: '考试类型', example: '考研' })
  @IsString()
  examType: string;

  @ApiProperty({ description: '考试日期' })
  @IsDateString()
  examDate: string;

  @ApiProperty({ description: '目标分数', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetScore?: number;

  @ApiProperty({
    description: '学科时间分配',
    example: { math: 2, politics: 1, english: 1, major: 2 },
  })
  subjectPlan: Record<string, number>;
}

export class UpdateStudyPlanDto {
  @ApiProperty({ description: '考试日期', required: false })
  @IsOptional()
  @IsDateString()
  examDate?: string;

  @ApiProperty({ description: '目标分数', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetScore?: number;

  @ApiProperty({ description: '学科时间分配', required: false })
  @IsOptional()
  subjectPlan?: Record<string, number>;

  @ApiProperty({ description: '计划状态', required: false, enum: PlanStatus })
  @IsOptional()
  status?: PlanStatus;
}

export class CreateDailyPlanDto {
  @ApiProperty({ description: '计划ID' })
  @IsString()
  planId: string;

  @ApiProperty({ description: '日期' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: '当日任务列表' })
  tasks: any[];
}

export class UpdateDailyPlanDto {
  @ApiProperty({ description: '已完成任务数', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  completedTasks?: number;

  @ApiProperty({ description: '学习时长(分钟)', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  studyTime?: number;

  @ApiProperty({ description: '状态', required: false, enum: DailyPlanStatus })
  @IsOptional()
  status?: DailyPlanStatus;
}
