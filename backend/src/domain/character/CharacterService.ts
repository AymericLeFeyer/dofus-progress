import { ICharacterRepository, CharacterWithGuild } from './ICharacterRepository';
import { Character, CharacterClass, CreateCharacterData, UpdateCharacterData } from './Character.entity';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';

export class CharacterService {
  constructor(private readonly characterRepository: ICharacterRepository) {}

  async createCharacter(userId: string, data: CreateCharacterData): Promise<Character> {
    const existing = await this.characterRepository.findByName(data.name);
    if (existing) throw new ConflictError(`Le personnage "${data.name}" existe déjà`);

    if (data.level < 1 || data.level > 200) {
      throw new AppError('Le niveau doit être compris entre 1 et 200');
    }

    return this.characterRepository.create({ ...data, userId });
  }

  async getUserCharacters(userId: string): Promise<CharacterWithGuild[]> {
    return this.characterRepository.findByUserIdWithGuild(userId);
  }

  async updateCharacter(userId: string, characterId: string, data: UpdateCharacterData): Promise<Character> {
    const character = await this.characterRepository.findById(characterId);
    if (!character) throw new NotFoundError('Personnage');
    if (character.userId !== userId) throw new ForbiddenError();

    if (data.name && data.name !== character.name) {
      const existing = await this.characterRepository.findByName(data.name);
      if (existing) throw new ConflictError(`Le personnage "${data.name}" existe déjà`);
    }

    if (data.level !== undefined && (data.level < 1 || data.level > 200)) {
      throw new AppError('Le niveau doit être compris entre 1 et 200');
    }

    return this.characterRepository.update(characterId, data);
  }

  async deleteCharacter(userId: string, characterId: string): Promise<void> {
    const character = await this.characterRepository.findById(characterId);
    if (!character) throw new NotFoundError('Personnage');
    if (character.userId !== userId) throw new ForbiddenError();

    const isLeader = await this.characterRepository.isGuildLeader(characterId);
    if (isLeader) {
      throw new AppError('Vous ne pouvez pas supprimer un personnage qui est chef de guilde', 409);
    }

    await this.characterRepository.delete(characterId);
  }

  async findByName(name: string): Promise<Character | null> {
    return this.characterRepository.findByName(name);
  }

  async findById(id: string): Promise<Character | null> {
    return this.characterRepository.findById(id);
  }
}
