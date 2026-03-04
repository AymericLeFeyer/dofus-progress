export enum GuildRole {
  LEADER = 'leader',
  OFFICER = 'officer',
  MEMBER = 'member',
}

export class GuildMember {
  constructor(
    public readonly guildId: string,
    public readonly characterId: string,
    public readonly role: GuildRole,
    public readonly joinedAt: Date,
  ) {}

  isLeader(): boolean {
    return this.role === GuildRole.LEADER;
  }

  canManageMembers(): boolean {
    return this.role === GuildRole.LEADER || this.role === GuildRole.OFFICER;
  }
}
