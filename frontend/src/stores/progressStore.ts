import { create } from 'zustand';
import { progressService, QuestStatus } from '../services/progress.service';

interface ProgressStore {
  completedQuestIds: Set<number>;
  startedQuestIds: Set<number>;
  blockedQuestIds: Set<number>;
  completedAchievementIds: Set<number>;
  todoDungeonIds: Set<number>;
  doneDungeonIds: Set<number>;
  totalPoints: number;
  achievementCategoryProgress: Record<number, number>;
  completedQuestCategoryProgress: Record<number, number>;
  startedQuestCategoryProgress: Record<number, number>;
  blockedQuestCategoryProgress: Record<number, number>;
  // Compat alias
  questCategoryProgress: Record<number, number>;
  pointsByCharacter: Record<string, number>;
  isLoading: boolean;

  fetchProgress: (characterId: string) => Promise<void>;
  fetchAllCharactersPoints: () => Promise<void>;
  toggleQuest: (characterId: string, questId: number) => Promise<void>;
  setQuestStatus: (characterId: string, questId: number, status: QuestStatus) => Promise<void>;
  toggleAchievement: (characterId: string, achievementId: number) => Promise<void>;
  completeAllAchievements: (characterId: string, categoryId: number) => Promise<void>;
  completeAllQuests: (characterId: string, categoryId: number) => Promise<void>;
  setDungeonStatus: (characterId: string, dungeonId: number, flags: { isTodo?: boolean; isDone?: boolean }) => Promise<void>;
  reset: () => void;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  completedQuestIds: new Set(),
  startedQuestIds: new Set(),
  blockedQuestIds: new Set(),
  completedAchievementIds: new Set(),
  todoDungeonIds: new Set(),
  doneDungeonIds: new Set(),
  totalPoints: 0,
  achievementCategoryProgress: {},
  completedQuestCategoryProgress: {},
  startedQuestCategoryProgress: {},
  blockedQuestCategoryProgress: {},
  questCategoryProgress: {},
  pointsByCharacter: {},
  isLoading: false,

  fetchProgress: async (characterId) => {
    set({ isLoading: true });
    try {
      const data = await progressService.getProgress(characterId);
      set({
        completedQuestIds: new Set(data.completedQuestIds),
        startedQuestIds: new Set(data.startedQuestIds),
        blockedQuestIds: new Set(data.blockedQuestIds ?? []),
        completedAchievementIds: new Set(data.completedAchievementIds),
        todoDungeonIds: new Set(data.todoDungeonIds ?? []),
        doneDungeonIds: new Set(data.doneDungeonIds ?? []),
        totalPoints: data.totalPoints,
        achievementCategoryProgress: data.achievementCategoryProgress,
        completedQuestCategoryProgress: data.completedQuestCategoryProgress,
        startedQuestCategoryProgress: data.startedQuestCategoryProgress,
        blockedQuestCategoryProgress: data.blockedQuestCategoryProgress ?? {},
        questCategoryProgress: data.completedQuestCategoryProgress,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchAllCharactersPoints: async () => {
    try {
      const list = await progressService.getAllCharactersPoints();
      const pointsByCharacter: Record<string, number> = {};
      list.forEach(({ characterId, totalPoints }) => {
        pointsByCharacter[characterId] = totalPoints;
      });
      set({ pointsByCharacter });
    } catch {
      // silent
    }
  },

  toggleQuest: async (characterId, questId) => {
    const result = await progressService.toggleQuest(characterId, questId);
    set((state) => {
      const nextCompleted = new Set(state.completedQuestIds);
      const nextStarted = new Set(state.startedQuestIds);
      if (result.status === 'started') {
        nextStarted.add(questId);
        nextCompleted.delete(questId);
      } else if (result.status === 'completed') {
        nextStarted.delete(questId);
        nextCompleted.add(questId);
      } else {
        nextStarted.delete(questId);
        nextCompleted.delete(questId);
      }
      return { completedQuestIds: nextCompleted, startedQuestIds: nextStarted };
    });
    await get().fetchProgress(characterId);
  },

  setQuestStatus: async (characterId, questId, status) => {
    await progressService.setQuestStatus(characterId, questId, status);
    await get().fetchProgress(characterId);
  },

  toggleAchievement: async (characterId, achievementId) => {
    const result = await progressService.toggleAchievement(characterId, achievementId);
    set((state) => {
      const next = new Set(state.completedAchievementIds);
      if (result.completed) next.add(achievementId);
      else next.delete(achievementId);
      return { completedAchievementIds: next };
    });
    await get().fetchProgress(characterId);
    set((state) => ({
      pointsByCharacter: { ...state.pointsByCharacter, [characterId]: state.totalPoints },
    }));
  },

  completeAllAchievements: async (characterId, categoryId) => {
    await progressService.completeAllAchievements(characterId, categoryId);
    await get().fetchProgress(characterId);
    set((state) => ({
      pointsByCharacter: { ...state.pointsByCharacter, [characterId]: state.totalPoints },
    }));
  },

  completeAllQuests: async (characterId, categoryId) => {
    await progressService.completeAllQuests(characterId, categoryId);
    await get().fetchProgress(characterId);
  },

  setDungeonStatus: async (characterId, dungeonId, flags) => {
    const result = await progressService.setDungeonStatus(characterId, dungeonId, flags);
    set((state) => {
      const nextTodo = new Set(state.todoDungeonIds);
      const nextDone = new Set(state.doneDungeonIds);
      if (result.isTodo) nextTodo.add(dungeonId);
      else nextTodo.delete(dungeonId);
      if (result.isDone) nextDone.add(dungeonId);
      else nextDone.delete(dungeonId);
      return { todoDungeonIds: nextTodo, doneDungeonIds: nextDone };
    });
  },

  reset: () => {
    set({
      completedQuestIds: new Set(),
      startedQuestIds: new Set(),
      blockedQuestIds: new Set(),
      completedAchievementIds: new Set(),
      todoDungeonIds: new Set(),
      doneDungeonIds: new Set(),
      totalPoints: 0,
      achievementCategoryProgress: {},
      completedQuestCategoryProgress: {},
      startedQuestCategoryProgress: {},
      blockedQuestCategoryProgress: {},
      questCategoryProgress: {},
    });
  },
}));
