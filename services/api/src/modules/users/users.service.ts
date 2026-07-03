import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './dto/user.dto';
import { UserResponseDto, LoginResponseDto, UserStatsDto } from './dto/response.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 用户注册
   */
  async register(dto: RegisterDto): Promise<LoginResponseDto> {
    // 检查邮箱是否已存在
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('该邮箱已被注册');
    }

    // 检查用户名是否已存在
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('该用户名已被使用');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: hashedPassword,
        nickname: dto.nickname || dto.username,
      },
    });

    // 生成token
    const accessToken = await this.generateToken(user.id, user.username);

    return {
      accessToken,
      user: this.toUserResponse(user),
    };
  }

  /**
   * 用户登录
   */
  async login(dto: LoginDto): Promise<LoginResponseDto> {
    // 查找用户(支持用户名或邮箱登录)
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.username }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 更新最后登录时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 生成token
    const accessToken = await this.generateToken(user.id, user.username);

    return {
      accessToken,
      user: this.toUserResponse(user),
    };
  }

  /**
   * 获取用户信息
   */
  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.toUserResponse(user);
  }

  /**
   * 更新用户信息
   */
  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        nickname: dto.nickname,
        avatar: dto.avatar,
        phone: dto.phone,
        settings: dto.settings,
      },
    });

    return this.toUserResponse(user);
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 验证当前密码
    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('当前密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  /**
   * 获取用户统计信息
   */
  async getStats(userId: string): Promise<UserStatsDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        learningRecords: {
          select: { createdAt: true },
        },
        knowledgeProgress: {
          where: { masteryLevel: { gte: 80 } },
        },
        achievements: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 计算连续学习天数
    const streakDays = this.calculateStreakDays(user.learningRecords.map(r => r.createdAt));

    return {
      totalStudyTime: user.totalStudyTime,
      totalQuestions: user.totalQuestions,
      correctRate: user.correctRate,
      streakDays,
      masteredKnowledgePoints: user.knowledgeProgress.length,
      unlockedAchievements: user.achievements.length,
    };
  }

  /**
   * 验证JWT Token
   */
  async validateUser(userId: string): Promise<UserResponseDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return this.toUserResponse(user);
  }

  /**
   * 生成JWT Token
   */
  private async generateToken(userId: string, username: string): Promise<string> {
    const payload = { sub: userId, username };
    return this.jwtService.signAsync(payload);
  }

  /**
   * 转换为响应DTO
   */
  private toUserResponse(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      phone: user.phone,
      totalStudyTime: user.totalStudyTime,
      totalQuestions: user.totalQuestions,
      correctRate: user.correctRate,
      isVip: user.isVip,
      vipExpireAt: user.vipExpireAt,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  /**
   * 计算连续学习天数
   */
  private calculateStreakDays(dates: Date[]): number {
    if (dates.length === 0) return 0;

    const uniqueDates = [...new Set(dates.map(d => d.toDateString()))];
    uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);

      if (uniqueDates.includes(checkDate.toDateString())) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
