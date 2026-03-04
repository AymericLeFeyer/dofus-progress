import { PrismaClient } from '@prisma/client';
import { ICharacterRepository, CharacterWithGuild } from '../../domain/character/ICharacterRepository';
import { Character, CharacterClass, CreateCharacterData, UpdateCharacterData } from '../../domain/character/Character.entity';

export class PrismaCharacterRepository implements ICharacterRepository {
  constructor(private readonly db: PrismaClient) {}

  private mapToEntity(row: { id: string; userId: string; name: string; class: string; level: number; createdAt: Date }): Character {
    return new Character(row.id, row.userId, row.name, row.class as CharacterClass, row.level, row.createdAt);
  }

  async findById(id: string): Promise<Character | null> {
    const row = await this.db.character.findUnique({ where: { id } });
    return row ? this.mapToEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<Character[]> {
    const rows = await this.db.character.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => this.mapToEntity(r));
  }

  async findByUserIdWithGuild(userId: string): Promise<CharacterWithGuild[]> {
    const rows = await this.db.character.findMany({
      where: { userId },
      include: {
        guildMember: {
          include: { guild: { select: { id: true, name: true, imageUrl: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      ...this.mapToEntity(r),
      guildMember: r.guildMember
        ? {
            guildId: r.guildMember.guildId,
            role: r.guildMember.role,
            joinedAt: r.guildMember.joinedAt,
            guild: r.guildMember.guild,
          }
        : undefined,
    }));
  }

  async findByName(name: string): Promise<Character | null> {
    const row = await this.db.character.findUnique({ where: { name } });
    return row ? this.mapToEntity(row) : null;
  }

  async create(data: CreateCharacterData): Promise<Character> {
    const row = await this.db.character.create({
      data: {
        userId: data.userId,
        name: data.name,
        class: data.characterClass,
        level: data.level,
      },
    });
    return this.mapToEntity(row);
  }

  async update(id: string, data: UpdateCharacterData): Promise<Character> {
    const row = await this.db.character.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.characterClass && { class: data.characterClass }),
        ...(data.level !== undefined && { level: data.level }),
      },
    });
    return this.mapToEntity(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.character.delete({ where: { id } });
  }

  async isGuildLeader(characterId: string): Promise<boolean> {
    const guild = await this.db.guild.findFirst({ where: { leaderId: characterId } });
    return !!guild;
  }
}
