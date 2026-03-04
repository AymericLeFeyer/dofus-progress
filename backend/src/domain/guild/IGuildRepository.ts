import { Guild, CreateGuildData } from './Guild.entity';
import { GuildMember, GuildRole } from './GuildMember.entity';
import { GuildInvitation, InvitationStatus } from './GuildInvitation.entity';

export interface GuildMemberWithCharacter extends GuildMember {
  character: {
    id: string;
    name: string;
    class: string;
    level: number;
  };
}

export interface GuildInvitationWithGuild extends GuildInvitation {
  guild: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
  character: {
    id: string;
    name: string;
  };
}

export interface CreateInvitationData {
  guildId: string;
  characterId: string;
  expiresAt: Date;
}

export interface IGuildRepository {
  findById(id: string): Promise<Guild | null>;
  findByName(name: string): Promise<Guild | null>;
  create(data: CreateGuildData): Promise<Guild>;

  findMembers(guildId: string): Promise<GuildMemberWithCharacter[]>;
  addMember(guildId: string, characterId: string, role: GuildRole): Promise<GuildMember>;
  removeMember(guildId: string, characterId: string): Promise<void>;
  findMemberByCharacterId(characterId: string): Promise<GuildMember | null>;

  createInvitation(data: CreateInvitationData): Promise<GuildInvitation>;
  findInvitationByToken(token: string): Promise<GuildInvitationWithGuild | null>;
  findPendingInvitationsByCharacterId(characterId: string): Promise<GuildInvitationWithGuild[]>;
  findPendingInvitationByGuildAndCharacter(guildId: string, characterId: string): Promise<GuildInvitation | null>;
  updateInvitationStatus(id: string, status: InvitationStatus): Promise<void>;
}
