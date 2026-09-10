import type { DeepPartial } from 'typeorm';
import { BaseRepository } from '../../../shared/repositories/baseRepository';
import { User } from '../entities/user.entity';

export class UserRepository extends BaseRepository<User> {
  static Instance = new UserRepository();

  private constructor() {
    super(User);
  }

  async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.repo.findOne({ where: { firebaseUid } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async create(data: DeepPartial<User>): Promise<User> {
    return this.repo.save(this.repo.create({ ...data, email: data.email?.toLowerCase() }));
  }

  async update(id: string, patch: DeepPartial<User>): Promise<User | null> {
    await this.repo.update(id, patch as never);
    return this.findById(id);
  }

  /**
   * Recorded on session establishment. A plain UPDATE rather than a read-then-save
   * so a sign-in never contends with a profile edit in flight.
   */
  async touchLastLogin(id: string): Promise<void> {
    await this.repo.update(id, { lastLoginAt: new Date() });
  }
}
