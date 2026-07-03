import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import {
  RegisterDto,
  LoginDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './dto/user.dto';
import { UserResponseDto, LoginResponseDto, UserStatsDto } from './dto/response.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功', type: LoginResponseDto })
  @ApiResponse({ status: 409, description: '邮箱或用户名已存在' })
  async register(@Body() dto: RegisterDto): Promise<LoginResponseDto> {
    return this.usersService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.usersService.login(dto);
  }

  @Get('profile')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: UserResponseDto })
  async getProfile(@CurrentUser('sub') userId: string): Promise<UserResponseDto> {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiResponse({ status: 200, description: '更新成功', type: UserResponseDto })
  async updateProfile(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.updateProfile(userId, dto);
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 204, description: '修改成功' })
  @ApiResponse({ status: 400, description: '当前密码错误' })
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.usersService.changePassword(userId, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取用户统计信息' })
  @ApiResponse({ status: 200, description: '获取成功', type: UserStatsDto })
  async getStats(@CurrentUser('sub') userId: string): Promise<UserStatsDto> {
    return this.usersService.getStats(userId);
  }
}
