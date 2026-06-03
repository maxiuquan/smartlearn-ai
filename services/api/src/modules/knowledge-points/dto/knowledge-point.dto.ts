import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsArray } from 'class-validator';

export class CreateKnowledgePointDto {
  @ApiProperty({ description: '学科ID' })
  @IsString()
  subjectId: string;

  @ApiProperty({ description: '知识点名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '知识点编码', required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '详细内容', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '父知识点ID', required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ description: '重要性 1-5', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  importance?: number;

  @ApiProperty({ description: '考频', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  frequency?: number;

  @ApiProperty({ description: '排序', required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateKnowledgePointDto {
  @ApiProperty({ description: '知识点名称', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '详细内容', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '重要性 1-5', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  importance?: number;

  @ApiProperty({ description: '考频', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  frequency?: number;
}

export class AddDependencyDto {
  @ApiProperty({ description: '依赖的知识点ID' })
  @IsString()
  dependsOnId: string;

  @ApiProperty({ description: '依赖强度 1-3', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  strength?: number;
}

export class QueryKnowledgePointDto {
  @ApiProperty({ description: '学科ID', required: false })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ description: '父知识点ID', required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({ description: '关键词搜索', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;
}
