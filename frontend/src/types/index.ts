export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface Character {
  id: string;
  userId: string;
  name: string;
  characterClass: string;
  level: number;
  createdAt: string;
  guildMember?: GuildMemberInfo;
}

export interface GuildMemberInfo {
  guildId: string;
  role: GuildRole;
  joinedAt: string;
  guild: GuildSummary;
}

export interface GuildSummary {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface Guild {
  id: string;
  name: string;
  imageUrl: string | null;
  leaderId: string;
  createdAt: string;
}

export interface GuildMember {
  guildId: string;
  characterId: string;
  role: GuildRole;
  joinedAt: string;
  character: {
    id: string;
    name: string;
    class: string;
    level: number;
  };
}

export interface GuildWithMembers extends Guild {
  members: GuildMember[];
}

export interface GuildInvitation {
  id: string;
  guildId: string;
  characterId: string;
  token: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  guild: GuildSummary;
  character: { id: string; name: string };
}

export type GuildRole = 'leader' | 'officer' | 'member';
export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface CreateCharacterData {
  name: string;
  characterClass: string;
  level: number;
}

export interface CreateGuildData {
  name: string;
  leaderCharacterId: string;
  imageUrl?: string;
}
