/**
 * Service encyclopédie — lit les données depuis le backend (PostgreSQL),
 * lui-même alimenté par le script sync-dofusdb.
 * Les étapes de quêtes sont encore chargées depuis DofusDB à la demande.
 */
import axios from 'axios';
import api from './api'; // backend authentifié
import type {
  DofusDBResponse,
  AchievementCategory,
  Achievement,
  QuestCategory,
  Quest,
  QuestStep,
  Dungeon,
} from '../types/dofusdb';

// Client direct DofusDB (uniquement pour les étapes de quêtes, chargées à la demande)
const dofusdb = axios.create({
  baseURL: '/dofusdb',
  params: { lang: 'fr' },
});

// Cache in-memory pour les listes statiques
const cache = new Map<string, unknown>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const result = await fn();
  cache.set(key, result);
  return result;
}

export const dofusdbService = {
  // ── Achievements (depuis le backend/DB) ──────────────────────────────────────

  async getAllAchievementCategories(): Promise<AchievementCategory[]> {
    return cached('ach-categories', async () => {
      const { data } = await api.get<(AchievementCategory & { achievementCount: number })[]>(
        '/achievements/categories',
      );
      // Reconstitue achievementIds comme tableau vide (le count est dans achievementCount)
      return data.map((c) => ({ ...c, achievementIds: [] }));
    });
  },

  async getAchievements(
    categoryId: number,
    skip = 0,
    limit = 50,
    search?: string,
  ): Promise<DofusDBResponse<Achievement>> {
    const { data } = await api.get<DofusDBResponse<Achievement>>('/achievements', {
      params: { categoryId, skip, limit, ...(search ? { search } : {}) },
    });
    return data;
  },

  async getAllAchievementsForCategory(categoryId: number): Promise<Achievement[]> {
    const PAGE = 500;
    const first = await api.get<DofusDBResponse<Achievement>>('/achievements', {
      params: { categoryId, skip: 0, limit: PAGE },
    });
    const { total, data } = first.data;
    const all = [...data];
    for (let skip = PAGE; skip < total; skip += PAGE) {
      const { data: res } = await api.get<DofusDBResponse<Achievement>>('/achievements', {
        params: { categoryId, skip, limit: PAGE },
      });
      all.push(...res.data);
    }
    return all;
  },

  // ── Quests (depuis le backend/DB) ────────────────────────────────────────────

  async getAllQuestCategories(): Promise<(QuestCategory & { questCount: number })[]> {
    return cached('quest-categories', async () => {
      const { data } = await api.get<(QuestCategory & { questCount: number })[]>(
        '/quests/categories',
      );
      return data;
    });
  },

  async getQuests(
    categoryId: number,
    skip = 0,
    limit = 50,
    search?: string,
  ): Promise<DofusDBResponse<Quest>> {
    const { data } = await api.get<DofusDBResponse<Quest>>('/quests', {
      params: { categoryId, skip, limit, ...(search ? { search } : {}) },
    });
    return data;
  },

  async getAllQuestsForCategory(categoryId: number): Promise<Quest[]> {
    const PAGE = 500;
    const first = await api.get<DofusDBResponse<Quest>>('/quests', {
      params: { categoryId, skip: 0, limit: PAGE },
    });
    const { total, data } = first.data;
    const all = [...data];
    for (let skip = PAGE; skip < total; skip += PAGE) {
      const { data: res } = await api.get<DofusDBResponse<Quest>>('/quests', {
        params: { categoryId, skip, limit: PAGE },
      });
      all.push(...res.data);
    }
    return all;
  },

  async getQuestsByIds(ids: number[]): Promise<Pick<Quest, 'id' | 'name' | 'categoryId' | 'levelMin' | 'levelMax' | 'isDungeonQuest' | 'isPartyQuest' | 'isEvent'>[]> {
    if (!ids.length) return [];
    const { data } = await api.get('/quests/by-ids', { params: { ids: ids.join(',') } });
    return data;
  },

  // ── Dungeons (depuis DofusDB directement) ────────────────────────────────────

  async getAllDungeons(): Promise<Dungeon[]> {
    return cached('dungeons-v3', async () => {
      const PAGE = 50;
      const first = await dofusdb.get<DofusDBResponse<Dungeon>>('/dungeons', {
        params: { '$limit': PAGE, '$skip': 0 },
      });
      const total = first.data.total;
      const all = [...first.data.data];
      for (let skip = PAGE; skip < total; skip += PAGE) {
        const { data } = await dofusdb.get<DofusDBResponse<Dungeon>>('/dungeons', {
          params: { '$limit': PAGE, '$skip': skip },
        });
        all.push(...data.data);
      }
      return all;
    });
  },

  // ── Quests (toutes, depuis le backend, en cache) ─────────────────────────────

  async getAllQuests(): Promise<Pick<Quest, 'id' | 'name' | 'categoryId' | 'levelMin' | 'levelMax' | 'isDungeonQuest' | 'isPartyQuest' | 'isEvent'>[]> {
    return cached('all-quests', async () => {
      const { data } = await api.get('/quests/all');
      return data;
    });
  },

  // ── Achievements (toutes, depuis le backend, en cache) ──────────────────────

  async getAllAchievements(): Promise<Achievement[]> {
    return cached('all-achievements', async () => {
      const { data: cats } = await api.get<{ id: number; achievementCount: number }[]>(
        '/achievements/categories',
      );
      const all: Achievement[] = [];
      for (const cat of cats) {
        if (!cat.achievementCount) continue;
        let skip = 0;
        while (skip < cat.achievementCount) {
          const { data } = await api.get<DofusDBResponse<Achievement>>('/achievements', {
            params: { categoryId: cat.id, skip, limit: 50 },
          });
          all.push(...data.data);
          if (data.data.length === 0) break;
          skip += data.data.length;
        }
      }
      return all;
    });
  },

  // ── Quest steps (depuis DofusDB directement, à la demande) ──────────────────

  async getQuestSteps(stepIds: number[]): Promise<QuestStep[]> {
    if (!stepIds.length) return [];
    const params: Record<string, unknown> = { $limit: 50 };
    stepIds.forEach((id, i) => (params[`id[$in][${i}]`] = id));
    const { data } = await dofusdb.get<DofusDBResponse<QuestStep>>('/quest-steps', { params });
    return data.data;
  },

  // ── Statut de synchronisation ────────────────────────────────────────────────

  async getSyncStatus(): Promise<{
    achievementCategories: number;
    achievements: number;
    questCategories: number;
    quests: number;
    lastSync: string | null;
    isSynced: boolean;
  }> {
    const { data } = await api.get('/encyclopedia/status');
    return data;
  },
};

// ── Utilitaires ──────────────────────────────────────────────────────────────

export function dofusColor(color: string | null | undefined): string {
  if (!color) return '#888888';
  return color.replace('0x', '#');
}

export function pointsColor(points: number): string {
  if (points >= 50) return 'gold';
  if (points >= 20) return 'purple';
  if (points >= 10) return 'blue';
  if (points >= 5) return 'green';
  return 'default';
}

export function levelRange(min: number, max: number): string {
  if (!min && !max) return '';
  if (min === max || !max) return `Niv. ${min}`;
  return `Niv. ${min}–${max}`;
}
