export class Guild {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly leaderId: string,
    public readonly imageUrl: string | null,
    public readonly createdAt: Date,
  ) {}
}

export interface CreateGuildData {
  name: string;
  leaderId: string;
  imageUrl?: string;
}
