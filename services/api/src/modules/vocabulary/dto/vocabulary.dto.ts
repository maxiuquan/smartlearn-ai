import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsArray, IsEnum } from 'class-validator';
import { VocabStatus } from '@prisma/client';

export class CreateVocabularyDto {
  @ApiProperty({ description: '单词' })
  @IsString()
  word: string;

  @ApiProperty({ description: '音标', required: false })
  @IsOptional()
  @IsString()
  phonetic?: string;

  @ApiProperty({ description: '含义(JSON数组)' })
  meaning: string;

  @ApiProperty({ description: '例句(JSON)', required: false })
  @IsOptional()
  example?: string;

  @ApiProperty({ description: '分类', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '难度级别', required: false })
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiProperty({ description: '词根', required: false })
  @IsOptional()
  @IsString()
  root?: string;

  @ApiProperty({ description: '词缀', required: false })
  @IsOptional()
  @IsString()
  affix?: string;

  @ApiProperty({ description: '同义词', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiProperty({ description: '反义词', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  antonyms?: string[];
}

export class QueryVocabularyDto {
  @ApiProperty({ description: '分类', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '关键词', required: false })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiProperty({ description: '状态', required: false, enum: VocabStatus })
  @IsOptional()
  @IsEnum(VocabStatus)
  status?: VocabStatus;

  @ApiProperty({ description: '页码', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: '每页数量', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SubmitVocabReviewDto {
  @ApiProperty({ description: '复习质量 0-5' })
  @IsInt()
  @Min(0)
  quality: number;
}
