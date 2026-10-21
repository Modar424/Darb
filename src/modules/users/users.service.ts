import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';
import { cleanText } from '../../common/utils/text';
import type { AuthUser, RequestMeta } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto } from './dto';
import { toUserDto, UserDto } from './user.mapper';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user);
  }

  /** Mass-assignment safe: only allowlisted fields are copied from the DTO. */
  async updateProfile(actor: AuthUser, dto: UpdateProfileDto, meta: RequestMeta): Promise<UserDto> {
    const user = await this.users.findOne({ where: { id: actor.id } });
    if (!user) throw new NotFoundException('User not found');
    const changed: string[] = [];
    if (dto.fullName !== undefined) {
      user.fullName = cleanText(dto.fullName);
      changed.push('fullName');
    }
    if (dto.bio !== undefined) {
      user.bio = cleanText(dto.bio) || null;
      changed.push('bio');
    }
    if (dto.locale !== undefined) {
      user.locale = dto.locale;
      changed.push('locale');
    }
    await this.users.save(user);
    await this.audit.record({
      actorId: actor.id,
      action: 'PROFILE_UPDATED',
      entityType: 'User',
      entityId: actor.id,
      metadata: { fields: changed },
      meta,
    });
    return toUserDto(user);
  }
}
