import {
  Controller,
  Get,
  Post,
  Put,
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
import { StudyPlanService } from './study-plan.service';
import {
  CreateStudyPlanDto,
  UpdateStudyPlanDto,
  CreateDailyPlanDto,
  UpdateDailyPlanDto,
} from './dto/study-plan.dto';
import {
  StudyPlanResponseDto,
  DailyPlanResponseDto,
  PlanOverviewDto,
  ScheduleSuggestionDto,
} from './dto/response.dto';

@ApiTags('study-plan')
@ApiBearerAuth()
@Controller('study-plan')
export class StudyPlanController {
  constructor(private readonly studyPlanService: StudyPlanService) {}

  @Post()
  @ApiOperation({ summary: '创建备考计划' })
  @ApiResponse({ status: 201, description: '创建成功', type: StudyPlanResponseDto })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateStudyPlanDto,
  ): Promise<StudyPlanResponseDto> {
    return this.studyPlanService.create(userId, dto);
  }

  @Get('active')
  @ApiOperation({ summary: '获取当前活跃计划' })
  @ApiResponse({ status: 200, description: '获取成功', type: StudyPlanResponseDto })
  async getActivePlan(
    @CurrentUser('sub') userId: string,
  ): Promise<StudyPlanResponseDto | null> {
    return this.studyPlanService.getActivePlan(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取备考计划' })
  @ApiParam({ name: 'id', description: '计划ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: StudyPlanResponseDto })
  async findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<StudyPlanResponseDto> {
    return this.studyPlanService.findOne(userId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新备考计划' })
  @ApiParam({ name: 'id', description: '计划ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: StudyPlanResponseDto })
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStudyPlanDto,
  ): Promise<StudyPlanResponseDto> {
    return this.studyPlanService.update(userId, id, dto);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: '获取计划概览' })
  @ApiParam({ name: 'id', description: '计划ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: PlanOverviewDto })
  async getOverview(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PlanOverviewDto> {
    return this.studyPlanService.getOverview(userId, id);
  }

  @Get(':id/suggestions')
  @ApiOperation({ summary: '获取学习建议' })
  @ApiParam({ name: 'id', description: '计划ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: [ScheduleSuggestionDto] })
  async getSuggestions(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<ScheduleSuggestionDto[]> {
    return this.studyPlanService.getSuggestions(userId, id);
  }

  @Post('daily')
  @ApiOperation({ summary: '创建每日计划' })
  @ApiResponse({ status: 201, description: '创建成功', type: DailyPlanResponseDto })
  async createDailyPlan(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDailyPlanDto,
  ): Promise<DailyPlanResponseDto> {
    return this.studyPlanService.createDailyPlan(userId, dto);
  }

  @Put('daily/:id')
  @ApiOperation({ summary: '更新每日计划' })
  @ApiParam({ name: 'id', description: '每日计划ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: DailyPlanResponseDto })
  async updateDailyPlan(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDailyPlanDto,
  ): Promise<DailyPlanResponseDto> {
    return this.studyPlanService.updateDailyPlan(userId, id, dto);
  }

  @Get(':id/daily')
  @ApiOperation({ summary: '获取每日计划列表' })
  @ApiParam({ name: 'id', description: '计划ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: [DailyPlanResponseDto] })
  async getDailyPlans(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<DailyPlanResponseDto[]> {
    return this.studyPlanService.getDailyPlans(userId, id, startDate, endDate);
  }
}
