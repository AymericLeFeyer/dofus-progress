import { PrismaClient } from '@prisma/client';
import { IUserRepository } from '../../domain/auth/IUserRepository';
import { User, CreateUserData } from '../../domain/auth/User.entity';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  private mapToEntity(row: { id: string; email: string; username: string; passwordHash: string; createdAt: Date }): User {
    return new User(row.id, row.email, row.username, row.passwordHash, row.createdAt);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { id } });
    return row ? this.mapToEntity(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { email } });
    return row ? this.mapToEntity(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const row = await this.db.user.findUnique({ where: { username } });
    return row ? this.mapToEntity(row) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await this.db.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: data.passwordHash,
      },
    });
    return this.mapToEntity(row);
  }
}
