import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta } from '../../common/decorators';
import type { AuthUser, RequestMeta } from '../../common/types';
import { UpdateProfileDto } from './dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto, @Meta() meta: RequestMeta) {
    return this.users.updateProfile(user, dto, meta);
  }
}
