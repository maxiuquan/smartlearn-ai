import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SubjectsService } from './subjects.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@ApiTags('subjects')
@ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @ApiOperation({ summary: '创建学科' })
  async create(@Body() dto: CreateSubjectDto) {
    return this.subjectsService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: '获取学科列表' })
  async findAll() {
    return this.subjectsService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '获取学科详情' })
  @ApiParam({ name: 'id', description: '学科ID' })
  async findOne(@Param('id') id: string) {
    return this.subjectsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新学科' })
  @ApiParam({ name: 'id', description: '学科ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateSubjectDto) {
    return this.subjectsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除学科' })
  @ApiParam({ name: 'id', description: '学科ID' })
  async remove(@Param('id') id: string) {
    return this.subjectsService.remove(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取学科统计' })
  @ApiParam({ name: 'id', description: '学科ID' })
  async getStats(@Param('id') id: string) {
    return this.subjectsService.getStats(id);
  }
}
