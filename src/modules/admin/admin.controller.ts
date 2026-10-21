import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Meta, Roles, UuidParam } from '../../common/decorators';
import type { AuthUser, RequestMeta } from '../../common/types';
import { RoleName } from '../../database/entities/enums';
import { AdminService } from './admin.service';
import {
  AdminCreateUserDto,
  AdminListCoursesQueryDto,
  AdminUpdateUserDto,
  ListAuditQueryDto,
  ListUsersQueryDto,
} from './dto';

@ApiTags('Admin')
@ApiCookieAuth()
@Roles(RoleName.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users') listUsers(@Query() q: ListUsersQueryDto) {
    return this.admin.listUsers(q);
  }
  @Get('users/:id') getUser(@UuidParam() id: string) {
    return this.admin.getUser(id);
  }
  @Post('users') createUser(
    @CurrentUser() u: AuthUser,
    @Body() dto: AdminCreateUserDto,
    @Meta() m: RequestMeta,
  ) {
    return this.admin.createUser(u, dto, m);
  }
  @Patch('users/:id') updateUser(
    @CurrentUser() u: AuthUser,
    @UuidParam() id: string,
    @Body() dto: AdminUpdateUserDto,
    @Meta() m: RequestMeta,
  ) {
    return this.admin.updateUser(u, id, dto, m);
  }
  @Get('courses') listCourses(@Query() q: AdminListCoursesQueryDto) {
    return this.admin.listCourses(q);
  }
  @Get('stats') stats() {
    return this.admin.stats();
  }
  @Get('audit-logs') auditLogs(@Query() q: ListAuditQueryDto) {
    return this.admin.auditLogs(q);
  }
}
