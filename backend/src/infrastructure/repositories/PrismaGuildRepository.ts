import { PrismaClient } from '@prisma/client';
import { IGuildRepository, GuildMemberWithCharacter, GuildInvitationWithGuild, CreateInvitationData } from '../../domain/guild/IGuildRepository';
import { Guild, CreateGuildData } from '../../domain/guild/Guild.entity';
import { GuildMember, GuildRole } from '../../domain/guild/GuildMember.entity';
import { GuildInvitation, InvitationStatus } from '../../domain/guild/GuildInvitation.entity';

export class PrismaGuildRepository implements IGuildRepository {
  constructor(private readonly db: PrismaClient) {}

  private mapGuild(row: { id: string; name: string; leaderId: string; imageUrl: string | null; createdAt: Date }): Guild {
    return new Guild(row.id, row.name, row.leaderId, row.imageUrl, row.createdAt);
  }

  private mapMember(row: { guildId: string; characterId: string; role: string; joinedAt: Date }): GuildMember {
    return new GuildMember(row.guildId, row.characterId, row.role as GuildRole, row.joinedAt);
  }

  private mapInvitation(row: { id: string; guildId: string; characterId: string; token: string; status: string; createdAt: Date; expiresAt: Date }): GuildInvitation {
    return new GuildInvitation(row.id, row.guildId, row.characterId, row.token, row.status as InvitationStatus, row.createdAt, row.expiresAt);
  }

  async findById(id: string): Promise<Guild | null> {
    const row = await this.db.guild.findUnique({ where: { id } });
    return row ? this.mapGuild(row) : null;
  }

  async findByName(name: string): Promise<Guild | null> {
    const row = await this.db.guild.findUnique({ where: { name } });
    return row ? this.mapGuild(row) : null;
  }

  async create(data: CreateGuildData): Promise<Guild> {
    const row = await this.db.guild.create({
      data: { name: data.name, leaderId: data.leaderId, imageUrl: data.imageUrl },
    });
    return this.mapGuild(row);
  }

  async findMembers(guildId: string): Promise<GuildMemberWithCharacter[]> {
    const rows = await this.db.guildMember.findMany({
      where: { guildId },
      include: { character: { select: { id: true, name: true, class: true, level: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) =>
      Object.assign(this.mapMember(r), {
        character: { id: r.character.id, name: r.character.name, class: r.character.class, level: r.character.level },
      }),
    );
  }

  async addMember(guildId: string, characterId: string, role: GuildRole): Promise<GuildMember> {
    const row = await this.db.guildMember.create({
      data: { guildId, characterId, role },
    });
    return this.mapMember(row);
  }

  async removeMember(guildId: string, characterId: string): Promise<void> {
    await this.db.guildMember.delete({ where: { guildId_characterId: { guildId, characterId } } });
  }

  async findMemberByCharacterId(characterId: string): Promise<GuildMember | null> {
    const row = await this.db.guildMember.findUnique({ where: { characterId } });
    return row ? this.mapMember(row) : null;
  }

  async createInvitation(data: CreateInvitationData): Promise<GuildInvitation> {
    const row = await this.db.guildInvitation.create({
      data: { guildId: data.guildId, characterId: data.characterId, expiresAt: data.expiresAt },
    });
    return this.mapInvitation(row);
  }

  async findInvitationByToken(token: string): Promise<GuildInvitationWithGuild | null> {
    const row = await this.db.guildInvitation.findUnique({
      where: { token },
      include: {
        guild: { select: { id: true, name: true, imageUrl: true } },
        character: { select: { id: true, name: true } },
      },
    });
    if (!row) return null;
    return Object.assign(this.mapInvitation(row), {
      guild: { id: row.guild.id, name: row.guild.name, imageUrl: row.guild.imageUrl },
      character: { id: row.character.id, name: row.character.name },
    });
  }

  async findPendingInvitationsByCharacterId(characterId: string): Promise<GuildInvitationWithGuild[]> {
    const rows = await this.db.guildInvitation.findMany({
      where: { characterId, status: 'pending', expiresAt: { gt: new Date() } },
      include: {
        guild: { select: { id: true, name: true, imageUrl: true } },
        character: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) =>
      Object.assign(this.mapInvitation(r), {
        guild: { id: r.guild.id, name: r.guild.name, imageUrl: r.guild.imageUrl },
        character: { id: r.character.id, name: r.character.name },
      }),
    );
  }

  async findPendingInvitationByGuildAndCharacter(guildId: string, characterId: string): Promise<GuildInvitation | null> {
    const row = await this.db.guildInvitation.findFirst({
      where: { guildId, characterId, status: 'pending', expiresAt: { gt: new Date() } },
    });
    return row ? this.mapInvitation(row) : null;
  }

  async updateInvitationStatus(id: string, status: InvitationStatus): Promise<void> {
    await this.db.guildInvitation.update({ where: { id }, data: { status } });
  }
}
