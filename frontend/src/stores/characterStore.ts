import { create } from 'zustand';
import { Character, CreateCharacterData } from '../types';
import { characterService } from '../services/character.service';

const SELECTED_KEY = 'selectedCharacterId';

interface CharacterStore {
  characters: Character[];
  classes: string[];
  isLoading: boolean;
  selectedCharacterId: string | null;
  selectedCharacter: Character | null;
  setSelectedCharacter: (id: string | null) => void;
  fetchCharacters: () => Promise<void>;
  fetchClasses: () => Promise<void>;
  createCharacter: (data: CreateCharacterData) => Promise<void>;
  updateCharacter: (id: string, data: Partial<CreateCharacterData>) => Promise<void>;
  deleteCharacter: (id: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterStore>((set, get) => ({
  characters: [],
  classes: [],
  isLoading: false,
  selectedCharacterId: localStorage.getItem(SELECTED_KEY) ?? null,
  get selectedCharacter() {
    const { characters, selectedCharacterId } = get();
    return characters.find((c) => c.id === selectedCharacterId) ?? null;
  },

  setSelectedCharacter: (id) => {
    if (id) localStorage.setItem(SELECTED_KEY, id);
    else localStorage.removeItem(SELECTED_KEY);
    set({ selectedCharacterId: id });
  },

  fetchCharacters: async () => {
    set({ isLoading: true });
    try {
      const characters = await characterService.getAll();
      // Auto-select first character if saved ID is no longer valid
      const savedId = localStorage.getItem(SELECTED_KEY);
      const stillValid = savedId && characters.some((c) => c.id === savedId);
      if (!stillValid && characters.length > 0) {
        const id = characters[0].id;
        localStorage.setItem(SELECTED_KEY, id);
        set({ characters, isLoading: false, selectedCharacterId: id });
      } else {
        set({ characters, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchClasses: async () => {
    try {
      const classes = await characterService.getClasses();
      set({ classes });
    } catch {
      // classes stay empty
    }
  },

  createCharacter: async (data) => {
    const character = await characterService.create(data);
    set((state) => ({ characters: [...state.characters, character] }));
  },

  updateCharacter: async (id, data) => {
    const updated = await characterService.update(id, data);
    set((state) => ({
      characters: state.characters.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteCharacter: async (id) => {
    await characterService.delete(id);
    set((state) => {
      const characters = state.characters.filter((c) => c.id !== id);
      // Si on supprime le personnage sélectionné, sélectionne le premier restant
      let selectedCharacterId = state.selectedCharacterId;
      if (selectedCharacterId === id) {
        selectedCharacterId = characters[0]?.id ?? null;
        if (selectedCharacterId) localStorage.setItem(SELECTED_KEY, selectedCharacterId);
        else localStorage.removeItem(SELECTED_KEY);
      }
      return { characters, selectedCharacterId };
    });
  },
}));
