import { Character, CreateCharacterData, UpdateCharacterData } from './Character.entity';

export interface CharacterGuildInfo {
  guildId: string;
  role: string;
  joinedAt: Date;
  guild: { id: string; name: string; imageUrl: string | null };
}

export interface CharacterWithGuild extends Character {
  guildMember?: CharacterGuildInfo;
}

export interface ICharacterRepository {
  findById(id: string): Promise<Character | null>;
  findByUserId(userId: string): Promise<Character[]>;
  findByUserIdWithGuild(userId: string): Promise<CharacterWithGuild[]>;
  findByName(name: string): Promise<Character | null>;
  create(data: CreateCharacterData): Promise<Character>;
  update(id: string, data: UpdateCharacterData): Promise<Character>;
  delete(id: string): Promise<void>;
  isGuildLeader(characterId: string): Promise<boolean>;
}
