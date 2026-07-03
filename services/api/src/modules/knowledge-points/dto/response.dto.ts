import { ApiProperty } from '@nestjs/swagger';

export class KnowledgePointResponseDto {
  @ApiProperty({ description: '知识点ID' })
  id: string;

  @ApiProperty({ description: '学科ID' })
  subjectId: string;

  @ApiProperty({ description: '知识点名称' })
  name: string;

  @ApiProperty({ description: '知识点编码', nullable: true })
  code: string | null;

  @ApiProperty({ description: '描述', nullable: true })
  description: string | null;

  @ApiProperty({ description: '详细内容', nullable: true })
  content: string | null;

  @ApiProperty({ description: '父知识点ID', nullable: true })
  parentId: string | null;

  @ApiProperty({ description: '层级' })
  level: number;

  @ApiProperty({ description: '路径' })
  path: string;

  @ApiProperty({ description: '重要性' })
  importance: number;

  @ApiProperty({ description: '考频' })
  frequency: number;

  @ApiProperty({ description: '子知识点', type: [KnowledgePointResponseDto] })
  children: KnowledgePointResponseDto[];
}

export class KnowledgeTreeDto {
  @ApiProperty({ description: '学科ID' })
  subjectId: string;

  @ApiProperty({ description: '学科名称' })
  subjectName: string;

  @ApiProperty({ description: '知识点树', type: [KnowledgePointResponseDto] })
  tree: KnowledgePointResponseDto[];
}

export class KnowledgeProgressDto {
  @ApiProperty({ description: '知识点ID' })
  knowledgeId: string;

  @ApiProperty({ description: '知识点名称' })
  name: string;

  @ApiProperty({ description: '掌握程度 0-100' })
  masteryLevel: number;

  @ApiProperty({ description: '尝试次数' })
  attemptCount: number;

  @ApiProperty({ description: '正确次数' })
  correctCount: number;

  @ApiProperty({ description: '正确率' })
  correctRate: number;

  @ApiProperty({ description: '最后练习时间', nullable: true })
  lastPracticeAt: Date | null;
}

export class DependencyGraphDto {
  @ApiProperty({ description: '知识点ID' })
  id: string;

  @ApiProperty({ description: '知识点名称' })
  name: string;

  @ApiProperty({ description: '依赖的知识点' })
  dependencies: { id: string; name: string; strength: number }[];

  @ApiProperty({ description: '被依赖的知识点' })
  dependents: { id: string; name: string; strength: number }[];
}
