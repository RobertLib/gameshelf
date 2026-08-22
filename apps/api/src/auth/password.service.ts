import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing with argon2id - the OWASP recommended choice for new
 * passwords. The parameters match the OWASP profile (19 MiB of memory, 2
 * iterations, parallelism 1).
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  /**
   * A hash used only to equalize timing when a non-existent account signs in.
   * Without it the response time reveals which emails are registered.
   */
  private dummyHash: string | null = null;

  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, this.options);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword, this.options);
    } catch {
      // A corrupt or foreign hash format - an invalid password, not a crash.
      return false;
    }
  }

  /** Burns roughly as much time as a real verification. */
  async burnTime(plainPassword: string): Promise<void> {
    this.dummyHash ??= await this.hash('gameshelf-timing-equalizer');
    await this.verify(this.dummyHash, plainPassword);
  }
}
