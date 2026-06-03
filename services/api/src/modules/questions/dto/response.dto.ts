import { ApiProperty } from '@nestjs/swagger';
import { Question, QuestionType, Difficulty } from '@prisma/client';

export class QuestionResponseDto {
  @ApiProperty({ description: '题目ID' })
  id: string;

  @ApiProperty({ description: '学科ID' })
  subjectId: string;

  @ApiProperty({ description: '分类ID', nullable: true })
  categoryId: string | null;

  @ApiProperty({ description: '题目类型', enum: QuestionType })
  type: QuestionType;

  @ApiProperty({ description: '难度', enum: Difficulty })
  difficulty: Difficulty;

  @ApiProperty({ description: '题目内容' })
  content: string;

  @ApiProperty({ description: '选项', nullable: true })
  options: any;

  @ApiProperty({ description: '答案' })
  answer: string;

  @ApiProperty({ description: '解析', nullable: true })
  analysis: string | null;

  @ApiProperty({ description: '标签', type: [String] })
  tags: string[];

  @ApiProperty({ description: '关键词', type: [String] })
  keywords: string[];

  @ApiProperty({ description: '来源', nullable: true })
  source: string | null;

  @ApiProperty({ description: '来源年份', nullable: true })
  sourceYear: number | null;

  @ApiProperty({ description: '作答次数' })
  attemptCount: number;

  @ApiProperty({ description: '正确次数' })
  correctCount: number;

  @ApiProperty({ description: '正确率' })
  correctRate: number;

  @ApiProperty({ description: '收藏次数' })
  favoriteCount: number;

  @ApiProperty({ description: '关联知识点', type: [String] })
  knowledgePoints: string[];

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

export class QuestionListResponseDto {
  @ApiProperty({ description: '题目列表', type: [QuestionResponseDto] })
  items: QuestionResponseDto[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '当前页' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  limit: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;
}

export class AnswerResultDto {
  @ApiProperty({ description: '是否正确' })
  isCorrect: boolean;

  @ApiProperty({ description: '正确答案' })
  correctAnswer: string;

  @ApiProperty({ description: '用户答案' })
  userAnswer: string;

  @ApiProperty({ description: '解析' })
  analysis: string;

  @ApiProperty({ description: '知识点', type: [String] })
  knowledgePoints: string[];
}

export class QuestionStatsDto {
  @ApiProperty({ description: '总题数' })
  total: number;

  @ApiProperty({ description: '各类型统计' })
  byType: Record<QuestionType, number>;

  @ApiProperty({ description: '各难度统计' })
  byDifficulty: Record<Difficulty, number>;

  @ApiProperty({ description: '各学科统计' })
  bySubject: Record<string, number>;
}
