import bcrypt from 'bcryptjs';
import { IUserRepository } from './IUserRepository';
import { User } from './User.entity';
import { AppError, ConflictError, UnauthorizedError } from '../../shared/errors/AppError';

export class AuthService {
  constructor(private readonly userRepository: IUserRepository) {}

  async register(email: string, username: string, password: string): Promise<User> {
    const emailExists = await this.userRepository.findByEmail(email);
    if (emailExists) throw new ConflictError('Cet email est déjà utilisé');

    const usernameExists = await this.userRepository.findByUsername(username);
    if (usernameExists) throw new ConflictError('Ce nom d\'utilisateur est déjà pris');

    if (password.length < 6) {
      throw new AppError('Le mot de passe doit contenir au moins 6 caractères');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    return this.userRepository.create({ email, username, passwordHash });
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new UnauthorizedError('Email ou mot de passe incorrect');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('Email ou mot de passe incorrect');

    return user;
  }

  async getById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
