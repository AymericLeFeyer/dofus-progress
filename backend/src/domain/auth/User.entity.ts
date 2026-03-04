export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly username: string,
    public readonly passwordHash: string,
    public readonly createdAt: Date,
  ) {}

  toPublic() {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      createdAt: this.createdAt,
    };
  }
}

export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string;
}
