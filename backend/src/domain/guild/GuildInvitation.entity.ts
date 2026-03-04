export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export class GuildInvitation {
  constructor(
    public readonly id: string,
    public readonly guildId: string,
    public readonly characterId: string,
    public readonly token: string,
    public readonly status: InvitationStatus,
    public readonly createdAt: Date,
    public readonly expiresAt: Date,
  ) {}

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isPending(): boolean {
    return this.status === InvitationStatus.PENDING && !this.isExpired();
  }
}
