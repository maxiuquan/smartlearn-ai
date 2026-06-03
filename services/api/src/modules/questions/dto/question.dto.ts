import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  IsJSON,
  Min,
  Max,
} from 'class-validator';
import { QuestionType, Difficulty, ContentStatus } from '@prisma/client';

export class CreateQuestionDto {
  @ApiProperty({ description: '学科ID' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: '分类ID', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    description: '题目类型',
    enum: QuestionType,
    example: 'SINGLE_CHOICE',
  })
  @IsEnum(QuestionType)
  type: QuestionType;

  @ApiProperty({
    description: '难度',
    enum: Difficulty,
    example: 'MEDIUM',
  })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiProperty({ description: '题目内容' })
  @IsString()
  content: string;

  @ApiProperty({ description: '选项(JSON数组)', required: false })
  @IsOptional()
  options?: any;

  @ApiProperty({ description: '答案' })
  @IsString()
  answer: string;

  @ApiProperty({ description: '解析', required: false })
  @IsOptional()
  @IsString()
  analysis?: string;

  @ApiProperty({ description: '标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: '关键词', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiProperty({ description: '来源', required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ description: '来源年份', required: false })
  @IsOptional()
  @IsInt()
  sourceYear?: number;

  @ApiProperty({ description: '来源书籍', required: false })
  @IsOptional()
  @IsString()
  sourceBook?: string;

  @ApiProperty({ description: '关联知识点ID列表', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgePointIds?: string[];
}

export class UpdateQuestionDto {
  @ApiProperty({ description: '分类ID', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: '难度', required: false, enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiProperty({ description: '题目内容', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '选项', required: false })
  @IsOptional()
  options?: any;

  @ApiProperty({ description: '答案', required: false })
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiProperty({ description: '解析', required: false })
  @IsOptional()
  @IsString()
  analysis?: string;

  @ApiProperty({ description: '标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: '关键词', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiProperty({ description: '状态', required: false, enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;
}

export class QueryQuestionDto {
  @ApiProperty({ description: '学科ID', required: false })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ description: '分类ID', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ description: '题目类型', required: false, enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiProperty({ description: '难度', required: false, enum: Difficulty })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiProperty({ description: '关键词搜索', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: '标签', required: false })
  @IsOptional()
  @IsString()
  tag?: string;

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

export class SubmitAnswerDto {
  @ApiProperty({ description: '用户答案' })
  @IsString()
  answer: string;

  @ApiProperty({ description: '用时(秒)', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpent?: number;

  @ApiProperty({ description: '答题模式', required: false, default: 'PRACTICE' })
  @IsOptional()
  @IsString()
  mode?: string;
}
