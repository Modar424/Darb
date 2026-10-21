import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { APP_CONFIG, AppConfig } from '../../config/configuration';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private get options(): argon2.HashOptions {
    return {
      type: argon2.argon2id,
      memoryCost: this.config.argon2.memoryKib,
      timeCost: this.config.argon2.timeCost,
      parallelism: 1,
    };
  }

  async onModuleInit(): Promise<void> {
    // Used to equalise timing when the account does not exist.
    this.dummyHash = await argon2.hash('dummy-password-for-timing-equalisation', this.options);
  }

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /** Performs a verification against a dummy hash so unknown accounts cost the same as known ones. */
  async burn(plain: string): Promise<void> {
    await this.verify(this.dummyHash, plain);
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.options);
  }
}
