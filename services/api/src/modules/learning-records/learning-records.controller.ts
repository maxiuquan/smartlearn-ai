import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LearningRecordsService } from './learning-records.service';
import { CreateLearningRecordDto, QueryLearningRecordDto } from './dto/learning-record.dto';
import {
  LearningRecordListDto,
  LearningProgressDto,
  DailyStatsDto,
} from './dto/response.dto';

@ApiTags('learning-records')
@ApiBearerAuth()
@Controller('learning-records')
export class LearningRecordsController {
  constructor(private readonly learningRecordsService: LearningRecordsService) {}

  @Post()
  @ApiOperation({ summary: '创建学习记录' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateLearningRecordDto,
  ) {
    return this.learningRecordsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: '获取学习记录列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: LearningRecordListDto })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() dto: QueryLearningRecordDto,
  ): Promise<LearningRecordListDto> {
    return this.learningRecordsService.findAll(userId, dto);
  }

  @Get('progress')
  @ApiOperation({ summary: '获取学习进度' })
  @ApiResponse({ status: 200, description: '获取成功', type: [LearningProgressDto] })
  async getProgress(
    @CurrentUser('sub') userId: string,
  ): Promise<LearningProgressDto[]> {
    return this.learningRecordsService.getProgress(userId);
  }

  @Get('daily-stats')
  @ApiOperation({ summary: '获取每日统计' })
  @ApiQuery({ name: 'days', required: false, description: '统计天数' })
  @ApiResponse({ status: 200, description: '获取成功', type: [DailyStatsDto] })
  async getDailyStats(
    @CurrentUser('sub') userId: string,
    @Query('days') days?: number,
  ): Promise<DailyStatsDto[]> {
    return this.learningRecordsService.getDailyStats(userId, days || 7);
  }
}
