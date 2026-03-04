import api from './api';

export type QuestStatus = 'started' | 'completed' | 'blocked' | 'todo';

export interface CharacterProgress {
  completedQuestIds: number[];
  startedQuestIds: number[];
  blockedQuestIds: number[];
  completedAchievementIds: number[];
  totalPoints: number;
  achievementCategoryProgress: Record<number, number>;
  questCategoryProgress: Record<number, number>;        // compat (= completed)
  completedQuestCategoryProgress: Record<number, number>;
  startedQuestCategoryProgress: Record<number, number>;
  blockedQuestCategoryProgress: Record<number, number>;
  todoDungeonIds: number[];
  doneDungeonIds: number[];
}

export interface GuildMemberProgress {
  characterId: string;
  name: string;
  class: string;
  level: number;
  role: string;
  completedQuestIds: number[];
  startedQuestIds: number[];
  blockedQuestIds: number[];
  completedAchievementIds: number[];
  totalPoints: number;
  achievementCategoryProgress: Record<number, number>;
  completedQuestCategoryProgress: Record<number, number>;
  startedQuestCategoryProgress: Record<number, number>;
  blockedQuestCategoryProgress: Record<number, number>;
  todoDungeonIds: number[];
  doneDungeonIds: number[];
}

export const progressService = {
  async getProgress(characterId: string): Promise<CharacterProgress> {
    const { data } = await api.get<CharacterProgress>(`/progress/${characterId}`);
    return data;
  },

  async getAllCharactersPoints(): Promise<{ characterId: string; totalPoints: number }[]> {
    const { data } = await api.get<{ characterId: string; totalPoints: number }[]>('/progress');
    return data;
  },

  async getGuildProgress(guildId: string): Promise<{ members: GuildMemberProgress[] }> {
    const { data } = await api.get<{ members: GuildMemberProgress[] }>(`/guild-progress/${guildId}`);
    return data;
  },

  async toggleQuest(characterId: string, questId: number): Promise<{ status: 'started' | 'completed' | 'todo' }> {
    const { data } = await api.post<{ status: 'started' | 'completed' | 'todo' }>(
      `/progress/${characterId}/quest/${questId}`,
    );
    return data;
  },

  async setQuestStatus(characterId: string, questId: number, status: QuestStatus): Promise<{ status: QuestStatus }> {
    const { data } = await api.put<{ status: QuestStatus }>(
      `/progress/${characterId}/quest/${questId}`,
      { status },
    );
    return data;
  },

  async toggleAchievement(characterId: string, achievementId: number): Promise<{ completed: boolean }> {
    const { data } = await api.post<{ completed: boolean }>(
      `/progress/${characterId}/achievement/${achievementId}`,
    );
    return data;
  },

  async completeAllAchievements(characterId: string, categoryId: number): Promise<{ count: number }> {
    const { data } = await api.post<{ count: number }>(
      `/progress/${characterId}/achievement/category/${categoryId}/all`,
    );
    return data;
  },

  async completeAllQuests(characterId: string, categoryId: number): Promise<{ count: number }> {
    const { data } = await api.post<{ count: number }>(
      `/progress/${characterId}/quest/category/${categoryId}/all`,
    );
    return data;
  },

  async setDungeonStatus(
    characterId: string,
    dungeonId: number,
    flags: { isTodo?: boolean; isDone?: boolean },
  ): Promise<{ isTodo: boolean; isDone: boolean }> {
    const { data } = await api.put<{ isTodo: boolean; isDone: boolean }>(
      `/progress/${characterId}/dungeon/${dungeonId}`,
      flags,
    );
    return data;
  },

  async getProfile(characterId: string): Promise<CharacterProfile> {
    const { data } = await api.get<CharacterProfile>(`/profile/${characterId}`);
    return data;
  },
};

export interface CharacterProfile extends CharacterProgress {
  character: {
    id: string;
    name: string;
    class: string;
    level: number;
    guild: { id: string; name: string; imageUrl: string | null } | null;
  };
}
