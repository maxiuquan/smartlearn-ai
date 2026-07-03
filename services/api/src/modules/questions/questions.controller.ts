import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QuestionsService } from './questions.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  QueryQuestionDto,
  SubmitAnswerDto,
} from './dto/question.dto';
import {
  QuestionResponseDto,
  QuestionListResponseDto,
  AnswerResultDto,
  QuestionStatsDto,
} from './dto/response.dto';

@ApiTags('questions')
@ApiBearerAuth()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Post()
  @ApiOperation({ summary: '创建题目' })
  @ApiResponse({ status: 201, description: '创建成功', type: QuestionResponseDto })
  async create(@Body() dto: CreateQuestionDto): Promise<QuestionResponseDto> {
    return this.questionsService.create(dto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量创建题目' })
  @ApiResponse({ status: 201, description: '批量创建成功' })
  async createMany(@Body() dtos: CreateQuestionDto[]): Promise<{ count: number }> {
    return this.questionsService.createMany(dtos);
  }

  @Get()
  @ApiOperation({ summary: '获取题目列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: QuestionListResponseDto })
  async findAll(@Query() dto: QueryQuestionDto): Promise<QuestionListResponseDto> {
    return this.questionsService.findAll(dto);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取题目统计' })
  @ApiResponse({ status: 200, description: '获取成功', type: QuestionStatsDto })
  async getStats(): Promise<QuestionStatsDto> {
    return this.questionsService.getStats();
  }

  @Get('random/:subjectId')
  @ApiOperation({ summary: '获取随机题目' })
  @ApiParam({ name: 'subjectId', description: '学科ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: [QuestionResponseDto] })
  async getRandom(
    @Param('subjectId') subjectId: string,
    @Query('count') count?: number,
    @Query('difficulty') difficulty?: string,
  ): Promise<QuestionResponseDto[]> {
    return this.questionsService.getRandom(subjectId, count || 10, difficulty);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个题目' })
  @ApiParam({ name: 'id', description: '题目ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: QuestionResponseDto })
  async findOne(@Param('id') id: string): Promise<QuestionResponseDto> {
    return this.questionsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新题目' })
  @ApiParam({ name: 'id', description: '题目ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: QuestionResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    return this.questionsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除题目' })
  @ApiParam({ name: 'id', description: '题目ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.questionsService.remove(id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: '提交答案' })
  @ApiParam({ name: 'id', description: '题目ID' })
  @ApiResponse({ status: 200, description: '提交成功', type: AnswerResultDto })
  async submitAnswer(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<AnswerResultDto> {
    return this.questionsService.submitAnswer(id, userId, dto);
  }
}
