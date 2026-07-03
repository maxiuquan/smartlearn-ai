import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { ReviewType, ReviewStatus } from '@prisma/client';

export class CreateReviewTaskDto {
  @ApiProperty({ description: '题目ID', required: false })
  @IsOptional()
  @IsString()
  questionId?: string;

  @ApiProperty({ description: '知识点ID', required: false })
  @IsOptional()
  @IsString()
  knowledgeId?: string;

  @ApiProperty({ description: '复习类型', enum: ReviewType })
  @IsEnum(ReviewType)
  type: ReviewType;

  @ApiProperty({ description: '下次复习时间', required: false })
  @IsOptional()
  @IsDateString()
  nextReviewAt?: string;
}

export class SubmitReviewDto {
  @ApiProperty({ description: '复习质量 0-5', example: 4 })
  @IsInt()
  @Min(0)
  quality: number;
}

export class QueryReviewTaskDto {
  @ApiProperty({ description: '复习状态', required: false, enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiProperty({ description: '复习类型', required: false, enum: ReviewType })
  @IsOptional()
  @IsEnum(ReviewType)
  type?: ReviewType;

  @ApiProperty({ description: '日期', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}
