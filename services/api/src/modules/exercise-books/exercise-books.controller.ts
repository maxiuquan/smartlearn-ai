import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ExerciseBooksService } from './exercise-books.service';
import {
  CreateExerciseBookDto,
  AddQuestionToBookDto,
  QueryExerciseBookDto,
  UpdateProgressDto,
} from './dto/exercise-book.dto';

@ApiTags('exercise-books')
@ApiBearerAuth()
@Controller('exercise-books')
export class ExerciseBooksController {
  constructor(private readonly exerciseBooksService: ExerciseBooksService) {}

  @Post()
  @ApiOperation({ summary: '创建习题册' })
  async create(@Body() dto: CreateExerciseBookDto) {
    return this.exerciseBooksService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: '获取习题册列表' })
  async findAll(@Query() dto: QueryExerciseBookDto) {
    return this.exerciseBooksService.findAll(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取习题册详情' })
  @ApiParam({ name: 'id', description: '习题册ID' })
  async findOne(@Param('id') id: string) {
    return this.exerciseBooksService.findOne(id);
  }

  @Post(':id/questions')
  @ApiOperation({ summary: '添加题目到习题册' })
  @ApiParam({ name: 'id', description: '习题册ID' })
  async addQuestion(
    @Param('id') id: string,
    @Body() dto: AddQuestionToBookDto,
  ) {
    return this.exerciseBooksService.addQuestion(id, dto);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: '获取用户习题册进度' })
  @ApiParam({ name: 'id', description: '习题册ID' })
  async getUserProgress(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.exerciseBooksService.getUserProgress(userId, id);
  }

  @Put('questions/:questionId/progress')
  @ApiOperation({ summary: '更新题目进度' })
  @ApiParam({ name: 'questionId', description: '习题册题目ID' })
  async updateProgress(
    @CurrentUser('sub') userId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.exerciseBooksService.updateProgress(userId, questionId, dto);
  }

  @Get('user/stats')
  @ApiOperation({ summary: '获取用户所有习题册统计' })
  async getStats(@CurrentUser('sub') userId: string) {
    return this.exerciseBooksService.getStats(userId);
  }
}
