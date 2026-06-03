import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { LearningMode } from '@prisma/client';

export class CreateLearningRecordDto {
  @ApiProperty({ description: '题目ID' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: '用户答案' })
  @IsString()
  userAnswer: string;

  @ApiProperty({ description: '用时(秒)', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpent?: number;

  @ApiProperty({ description: '答题模式', required: false, enum: LearningMode })
  @IsOptional()
  @IsEnum(LearningMode)
  mode?: LearningMode;
}

export class QueryLearningRecordDto {
  @ApiProperty({ description: '学科ID', required: false })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ description: '开始日期', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: '结束日期', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: '每页数量', required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
