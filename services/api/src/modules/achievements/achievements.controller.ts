import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AchievementsService } from './achievements.service';
import { CreateAchievementDto } from './dto/achievement.dto';

@ApiTags('achievements')
@ApiBearerAuth()
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Post()
  @ApiOperation({ summary: '创建成就' })
  async create(@Body() dto: CreateAchievementDto) {
    return this.achievementsService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: '获取成就列表' })
  async findAll(@Query('includeHidden') includeHidden?: boolean) {
    return this.achievementsService.findAll(includeHidden);
  }

  @Get('user')
  @ApiOperation({ summary: '获取用户成就' })
  async getUserAchievements(@CurrentUser('sub') userId: string) {
    return this.achievementsService.getUserAchievements(userId);
  }

  @Get('user/progress')
  @ApiOperation({ summary: '获取成就进度' })
  async getProgress(@CurrentUser('sub') userId: string) {
    return this.achievementsService.getProgress(userId);
  }
}
