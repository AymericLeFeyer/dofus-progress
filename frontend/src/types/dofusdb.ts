export interface DofusDBResponse<T> {
  total: number;
  limit: number;
  skip: number;
  data: T[];
}

export interface I18nText {
  id?: string;
  fr: string;
  en: string;
  de?: string;
  es?: string;
  pt?: string;
}

// ── Achievement ──────────────────────────────────────────────────────────────

export interface AchievementCategory {
  id: number;
  parentId: number;
  name: I18nText;
  color: string;
  icon: string;
  order: number;
  achievementIds: number[];
  parent?: AchievementCategory;
}

export interface Achievement {
  id: number;
  categoryId: number;
  iconId: number;
  points: number;
  level: number;
  order: number;
  accountLinked: boolean;
  name: I18nText;
  description: I18nText;
  img: string;
  objectiveIds: number[];
  rewardIds: number[];
  objectives: AchievementObjective[];
}

export interface AchievementObjective {
  id: number;
  name: I18nText;
  criterion: string;
}

// ── Quest ────────────────────────────────────────────────────────────────────

export interface QuestCategory {
  id: number;
  order: number;
  name: I18nText;
  questIds: number[];
}

export interface Quest {
  id: number;
  categoryId: number;
  name: I18nText;
  levelMin: number;
  levelMax: number;
  isDungeonQuest: boolean;
  isPartyQuest: boolean;
  repeatType: number;
  repeatLimit: number;
  stepIds: number[];
  followable: boolean;
  isEvent: boolean;
  steps?: QuestStep[];
}

export interface QuestStep {
  id: number;
  name: I18nText;
  description?: I18nText;
  optimalLevel: number;
  duration: number;
  objectiveIds: number[];
  rewardIds: number[];
}

// ── Dungeon ──────────────────────────────────────────────────────────────────

export interface Dungeon {
  id: number;
  name: I18nText;
  level: number;
  monsterIds: number[];
  mapIds: number[];
  entranceMapId?: number;
  exitMapId?: number;
}

// ── Monster ──────────────────────────────────────────────────────────────────

export interface Monster {
  id: number;
  name: I18nText;
  img?: string;
}
