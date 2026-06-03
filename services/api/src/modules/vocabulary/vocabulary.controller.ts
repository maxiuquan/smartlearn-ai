import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { VocabularyService } from './vocabulary.service';
import { CreateVocabularyDto, QueryVocabularyDto, SubmitVocabReviewDto } from './dto/vocabulary.dto';

@ApiTags('vocabulary')
@ApiBearerAuth()
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Post()
  @ApiOperation({ summary: '创建单词' })
  async create(@Body() dto: CreateVocabularyDto) {
    return this.vocabularyService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: '获取单词列表' })
  async findAll(@Query() dto: QueryVocabularyDto) {
    return this.vocabularyService.findAll(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取单词详情' })
  @ApiParam({ name: 'id', description: '单词ID' })
  async findOne(@Param('id') id: string) {
    return this.vocabularyService.findOne(id);
  }

  @Get('user/list')
  @ApiOperation({ summary: '获取用户单词列表' })
  async getUserVocab(
    @CurrentUser('sub') userId: string,
    @Query() dto: QueryVocabularyDto,
  ) {
    return this.vocabularyService.getUserVocab(userId, dto);
  }

  @Get('user/review')
  @ApiOperation({ summary: '获取待复习单词' })
  async getReviewList(
    @CurrentUser('sub') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.vocabularyService.getReviewList(userId, limit || 20);
  }

  @Post(':id/review')
  @ApiOperation({ summary: '提交单词复习' })
  @ApiParam({ name: 'id', description: '单词ID' })
  async submitReview(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: SubmitVocabReviewDto,
  ) {
    return this.vocabularyService.submitReview(userId, id, dto);
  }

  @Get('user/stats')
  @ApiOperation({ summary: '获取单词学习统计' })
  async getStats(@CurrentUser('sub') userId: string) {
    return this.vocabularyService.getStats(userId);
  }
}
