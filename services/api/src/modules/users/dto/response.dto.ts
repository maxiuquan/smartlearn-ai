import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '邮箱' })
  email: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '昵称', nullable: true })
  nickname: string | null;

  @ApiProperty({ description: '头像', nullable: true })
  avatar: string | null;

  @ApiProperty({ description: '手机号', nullable: true })
  phone: string | null;

  @ApiProperty({ description: '总学习时长(分钟)' })
  totalStudyTime: number;

  @ApiProperty({ description: '总答题数' })
  totalQuestions: number;

  @ApiProperty({ description: '正确率' })
  correctRate: number;

  @ApiProperty({ description: '是否VIP' })
  isVip: boolean;

  @ApiProperty({ description: 'VIP到期时间', nullable: true })
  vipExpireAt: Date | null;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '最后登录时间', nullable: true })
  lastLoginAt: Date | null;
}

export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '用户信息', type: UserResponseDto })
  user: UserResponseDto;
}

export class UserStatsDto {
  @ApiProperty({ description: '总学习时长(分钟)' })
  totalStudyTime: number;

  @ApiProperty({ description: '总答题数' })
  totalQuestions: number;

  @ApiProperty({ description: '正确率' })
  correctRate: number;

  @ApiProperty({ description: '连续学习天数' })
  streakDays: number;

  @ApiProperty({ description: '已掌握知识点数' })
  masteredKnowledgePoints: number;

  @ApiProperty({ description: '已解锁成就数' })
  unlockedAchievements: number;
}
