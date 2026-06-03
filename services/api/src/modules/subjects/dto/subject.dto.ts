import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ description: '学科名称', example: '数学' })
  @IsString()
  name: string;

  @ApiProperty({ description: '学科代码', example: 'math' })
  @IsString()
  code: string;

  @ApiProperty({ description: '图标', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ description: '颜色', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '排序', required: false })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateSubjectDto {
  @ApiProperty({ description: '学科名称', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '图标', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ description: '颜色', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '是否启用', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
