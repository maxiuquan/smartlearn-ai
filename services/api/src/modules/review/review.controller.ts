import {
  Controller,
  Get,
  Post,
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
import { ReviewService } from './review.service';
import { CreateReviewTaskDto, SubmitReviewDto, QueryReviewTaskDto } from './dto/review.dto';
import { ReviewTaskResponseDto, ReviewStatsDto, ForgettingCurveDto } from './dto/response.dto';

@ApiTags('review')
@ApiBearerAuth()
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('tasks')
  @ApiOperation({ summary: '创建复习任务' })
  @ApiResponse({ status: 201, description: '创建成功', type: ReviewTaskResponseDto })
  async createTask(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReviewTaskDto,
  ): Promise<ReviewTaskResponseDto> {
    return this.reviewService.create(userId, dto);
  }

  @Get('tasks')
  @ApiOperation({ summary: '获取复习任务列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [ReviewTaskResponseDto] })
  async getTasks(
    @CurrentUser('sub') userId: string,
    @Query() dto: QueryReviewTaskDto,
  ): Promise<ReviewTaskResponseDto[]> {
    return this.reviewService.findAll(userId, dto);
  }

  @Get('tasks/today')
  @ApiOperation({ summary: '获取今日复习任务' })
  @ApiResponse({ status: 200, description: '获取成功', type: [ReviewTaskResponseDto] })
  async getTodayTasks(
    @CurrentUser('sub') userId: string,
  ): Promise<ReviewTaskResponseDto[]> {
    return this.reviewService.getTodayTasks(userId);
  }

  @Post('tasks/:id/submit')
  @ApiOperation({ summary: '提交复习结果' })
  @ApiParam({ name: 'id', description: '任务ID' })
  @ApiResponse({ status: 200, description: '提交成功', type: ReviewTaskResponseDto })
  async submitReview(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitReviewDto,
  ): Promise<ReviewTaskResponseDto> {
    return this.reviewService.submitReview(id, userId, dto);
  }

  @Post('tasks/:id/skip')
  @ApiOperation({ summary: '跳过复习' })
  @ApiParam({ name: 'id', description: '任务ID' })
  @ApiResponse({ status: 200, description: '跳过成功', type: ReviewTaskResponseDto })
  async skipReview(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ): Promise<ReviewTaskResponseDto> {
    return this.reviewService.skipReview(id, userId);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取复习统计' })
  @ApiResponse({ status: 200, description: '获取成功', type: ReviewStatsDto })
  async getStats(
    @CurrentUser('sub') userId: string,
  ): Promise<ReviewStatsDto> {
    return this.reviewService.getStats(userId);
  }

  @Get('forgetting-curve')
  @ApiOperation({ summary: '获取遗忘曲线' })
  @ApiResponse({ status: 200, description: '获取成功', type: [ForgettingCurveDto] })
  async getForgettingCurve(
    @CurrentUser('sub') userId: string,
    @Query('days') days?: number,
  ): Promise<ForgettingCurveDto[]> {
    return this.reviewService.getForgettingCurve(userId, days || 30);
  }
}
