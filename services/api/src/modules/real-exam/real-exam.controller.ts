import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RealExamService } from './real-exam.service';
import { CreateExamPaperDto, StartExamDto, SubmitExamDto, QueryExamPaperDto } from './dto/exam.dto';

@ApiTags('real-exam')
@ApiBearerAuth()
@Controller('real-exam')
export class RealExamController {
  constructor(private readonly realExamService: RealExamService) {}

  @Post('papers')
  @ApiOperation({ summary: '创建真题试卷' })
  async createPaper(@Body() dto: CreateExamPaperDto) {
    return this.realExamService.createPaper(dto);
  }

  @Public()
  @Get('papers')
  @ApiOperation({ summary: '获取真题试卷列表' })
  async findPapers(@Query() dto: QueryExamPaperDto) {
    return this.realExamService.findPapers(dto);
  }

  @Public()
  @Get('papers/:id')
  @ApiOperation({ summary: '获取真题试卷详情' })
  @ApiParam({ name: 'id', description: '试卷ID' })
  async findPaper(@Param('id') id: string) {
    return this.realExamService.findPaper(id);
  }

  @Post('start')
  @ApiOperation({ summary: '开始考试' })
  async startExam(
    @CurrentUser('sub') userId: string,
    @Body() dto: StartExamDto,
  ) {
    return this.realExamService.startExam(userId, dto);
  }

  @Post('submit/:recordId')
  @ApiOperation({ summary: '提交考试' })
  @ApiParam({ name: 'recordId', description: '考试记录ID' })
  async submitExam(
    @CurrentUser('sub') userId: string,
    @Param('recordId') recordId: string,
    @Body() dto: SubmitExamDto,
  ) {
    return this.realExamService.submitExam(userId, recordId, dto);
  }

  @Get('records')
  @ApiOperation({ summary: '获取考试记录列表' })
  async getRecords(@CurrentUser('sub') userId: string) {
    return this.realExamService.getRecords(userId);
  }

  @Get('records/:id')
  @ApiOperation({ summary: '获取考试记录详情' })
  @ApiParam({ name: 'id', description: '记录ID' })
  async getRecordDetail(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.realExamService.getRecordDetail(userId, id);
  }
}
