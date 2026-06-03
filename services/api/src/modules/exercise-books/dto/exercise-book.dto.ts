import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsArray } from 'class-validator';

export class CreateExerciseBookDto {
  @ApiProperty({ description: '学科ID' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: '习题册名称', example: '考研数学660题' })
  @IsString()
  name: string;

  @ApiProperty({ description: '代码', example: '660' })
  @IsString()
  code: string;

  @ApiProperty({ description: '作者', required: false })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiProperty({ description: '出版社', required: false })
  @IsOptional()
  @IsString()
  publisher?: string;

  @ApiProperty({ description: '年份', required: false })
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '封面', required: false })
  @IsOptional()
  @IsString()
  cover?: string;
}

export class AddQuestionToBookDto {
  @ApiProperty({ description: '题目ID' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: '章节', required: false })
  @IsOptional()
  @IsInt()
  chapter?: number;

  @ApiProperty({ description: '小节', required: false })
  @IsOptional()
  @IsInt()
  section?: number;

  @ApiProperty({ description: '题号' })
  @IsInt()
  @Min(1)
  order: number;
}

export class QueryExerciseBookDto {
  @ApiProperty({ description: '学科ID', required: false })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class UpdateProgressDto {
  @ApiProperty({ description: '用户答案', required: false })
  @IsOptional()
  @IsString()
  userAnswer?: string;

  @ApiProperty({ description: '是否正确', required: false })
  @IsOptional()
  isCorrect?: boolean;

  @ApiProperty({ description: '用时(秒)', required: false })
  @IsOptional()
  @IsInt()
  timeSpent?: number;
}
