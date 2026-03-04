import api from './api';
import { Character, CreateCharacterData } from '../types';

export const characterService = {
  async getAll(): Promise<Character[]> {
    const { data } = await api.get<Character[]>('/characters');
    return data;
  },

  async create(data: CreateCharacterData): Promise<Character> {
    const { data: character } = await api.post<Character>('/characters', data);
    return character;
  },

  async update(id: string, data: Partial<CreateCharacterData>): Promise<Character> {
    const { data: character } = await api.put<Character>(`/characters/${id}`, data);
    return character;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/characters/${id}`);
  },

  async getClasses(): Promise<string[]> {
    const { data } = await api.get<string[]>('/characters/classes');
    return data;
  },
};
