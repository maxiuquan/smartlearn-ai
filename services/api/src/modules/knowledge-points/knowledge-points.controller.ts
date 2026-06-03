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
import { KnowledgePointsService } from './knowledge-points.service';
import {
  CreateKnowledgePointDto,
  UpdateKnowledgePointDto,
  AddDependencyDto,
  QueryKnowledgePointDto,
} from './dto/knowledge-point.dto';
import {
  KnowledgePointResponseDto,
  KnowledgeTreeDto,
  KnowledgeProgressDto,
  DependencyGraphDto,
} from './dto/response.dto';

@ApiTags('knowledge-points')
@ApiBearerAuth()
@Controller('knowledge-points')
export class KnowledgePointsController {
  constructor(private readonly knowledgePointsService: KnowledgePointsService) {}

  @Post()
  @ApiOperation({ summary: '创建知识点' })
  @ApiResponse({ status: 201, description: '创建成功', type: KnowledgePointResponseDto })
  async create(
    @Body() dto: CreateKnowledgePointDto,
  ): Promise<KnowledgePointResponseDto> {
    return this.knowledgePointsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取知识点列表' })
  @ApiResponse({ status: 200, description: '获取成功', type: [KnowledgePointResponseDto] })
  async findAll(
    @Query() dto: QueryKnowledgePointDto,
  ): Promise<KnowledgePointResponseDto[]> {
    return this.knowledgePointsService.findAll(dto);
  }

  @Get('tree/:subjectId')
  @ApiOperation({ summary: '获取知识点树' })
  @ApiParam({ name: 'subjectId', description: '学科ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: KnowledgeTreeDto })
  async getTree(
    @Param('subjectId') subjectId: string,
  ): Promise<KnowledgeTreeDto> {
    return this.knowledgePointsService.getTree(subjectId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个知识点' })
  @ApiParam({ name: 'id', description: '知识点ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: KnowledgePointResponseDto })
  async findOne(
    @Param('id') id: string,
  ): Promise<KnowledgePointResponseDto> {
    return this.knowledgePointsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新知识点' })
  @ApiParam({ name: 'id', description: '知识点ID' })
  @ApiResponse({ status: 200, description: '更新成功', type: KnowledgePointResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgePointDto,
  ): Promise<KnowledgePointResponseDto> {
    return this.knowledgePointsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识点' })
  @ApiParam({ name: 'id', description: '知识点ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.knowledgePointsService.remove(id);
  }

  @Post(':id/dependencies')
  @ApiOperation({ summary: '添加依赖关系' })
  @ApiParam({ name: 'id', description: '知识点ID' })
  @ApiResponse({ status: 201, description: '添加成功' })
  async addDependency(
    @Param('id') id: string,
    @Body() dto: AddDependencyDto,
  ): Promise<void> {
    return this.knowledgePointsService.addDependency(id, dto);
  }

  @Delete(':id/dependencies/:dependsOnId')
  @ApiOperation({ summary: '移除依赖关系' })
  @ApiParam({ name: 'id', description: '知识点ID' })
  @ApiParam({ name: 'dependsOnId', description: '依赖的知识点ID' })
  @ApiResponse({ status: 204, description: '移除成功' })
  async removeDependency(
    @Param('id') id: string,
    @Param('dependsOnId') dependsOnId: string,
  ): Promise<void> {
    return this.knowledgePointsService.removeDependency(id, dependsOnId);
  }

  @Get(':id/dependency-graph')
  @ApiOperation({ summary: '获取依赖图' })
  @ApiParam({ name: 'id', description: '知识点ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: DependencyGraphDto })
  async getDependencyGraph(
    @Param('id') id: string,
  ): Promise<DependencyGraphDto> {
    return this.knowledgePointsService.getDependencyGraph(id);
  }

  @Get('progress/:subjectId')
  @ApiOperation({ summary: '获取用户知识点进度' })
  @ApiParam({ name: 'subjectId', description: '学科ID' })
  @ApiResponse({ status: 200, description: '获取成功', type: [KnowledgeProgressDto] })
  async getUserProgress(
    @CurrentUser('sub') userId: string,
    @Param('subjectId') subjectId: string,
  ): Promise<KnowledgeProgressDto[]> {
    return this.knowledgePointsService.getUserProgress(userId, subjectId);
  }
}
