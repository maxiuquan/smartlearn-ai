import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsJSON } from 'class-validator';
import { AchievementType, Rarity } from '@prisma/client';

export class CreateAchievementDto {
  @ApiProperty({ description: '成就代码', example: 'first_100_questions' })
  @IsString()
  code: string;

  @ApiProperty({ description: '成就名称', example: '初试锋芒' })
  @IsString()
  name: string;

  @ApiProperty({ description: '成就描述' })
  @IsString()
  description: string;

  @ApiProperty({ description: '图标', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ description: '徽章图片', required: false })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiProperty({ description: '成就类型', enum: AchievementType })
  @IsEnum(AchievementType)
  type: AchievementType;

  @ApiProperty({ description: '分类', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '达成条件' })
  condition: Record<string, any>;

  @ApiProperty({ description: '积分奖励', required: false })
  @IsOptional()
  @IsInt()
  points?: number;

  @ApiProperty({ description: '称号', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: '稀有度', required: false, enum: Rarity })
  @IsOptional()
  @IsEnum(Rarity)
  rarity?: Rarity;

  @ApiProperty({ description: '是否隐藏', required: false })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;
}
