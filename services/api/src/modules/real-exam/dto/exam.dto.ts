import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsDateString, IsJSON } from 'class-validator';

export class CreateExamPaperDto {
  @ApiProperty({ description: '学科ID' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: '试卷名称', example: '2024年考研数学一' })
  @IsString()
  name: string;

  @ApiProperty({ description: '年份' })
  @IsInt()
  year: number;

  @ApiProperty({ description: '考试类型', example: '考研' })
  @IsString()
  examType: string;

  @ApiProperty({ description: '总分' })
  @IsInt()
  @Min(0)
  totalScore: number;

  @ApiProperty({ description: '时长(分钟)' })
  @IsInt()
  @Min(1)
  duration: number;

  @ApiProperty({ description: '试卷结构' })
  sections: any;

  @ApiProperty({ description: '来源', required: false })
  @IsOptional()
  @IsString()
  source?: string;
}

export class StartExamDto {
  @ApiProperty({ description: '试卷ID' })
  @IsString()
  paperId: string;
}

export class SubmitExamDto {
  @ApiProperty({ description: '答案记录' })
  answers: Record<string, string>;
}

export class QueryExamPaperDto {
  @ApiProperty({ description: '学科ID', required: false })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ description: '年份', required: false })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiProperty({ description: '考试类型', required: false })
  @IsOptional()
  @IsString()
  examType?: string;
}
