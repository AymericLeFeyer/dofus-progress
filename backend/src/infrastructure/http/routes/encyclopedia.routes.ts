import { FastifyInstance } from 'fastify';
import { prisma } from '../../../infrastructure/prisma/client';

export async function encyclopediaRoutes(fastify: FastifyInstance) {
  // ── Achievement categories ──────────────────────────────────────────────────

  fastify.get('/achievements/categories', async () => {
    const cats = await prisma.achievementCategory.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { achievements: true } } },
    });
    return cats.map((c) => ({
      id: c.id,
      parentId: c.parentId,
      name: { fr: c.nameFr, en: c.nameEn },
      color: c.color,
      icon: c.icon,
      order: c.order,
      achievementCount: c._count.achievements,
    }));
  });

  // ── Achievements ────────────────────────────────────────────────────────────

  fastify.get('/achievements', async (request) => {
    const { categoryId, skip = '0', limit = '50', search } = request.query as {
      categoryId?: string;
      skip?: string;
      limit?: string;
      search?: string;
    };

    const where = {
      ...(categoryId ? { categoryId: Number(categoryId) } : {}),
      ...(search
        ? {
            OR: [
              { nameFr: { contains: search, mode: 'insensitive' as const } },
              { descriptionFr: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.achievement.findMany({
        where,
        orderBy: { order: 'asc' },
        skip: Number(skip),
        take: Math.min(Number(limit), 100),
      }),
      prisma.achievement.count({ where }),
    ]);

    return {
      total,
      skip: Number(skip),
      limit: Number(limit),
      data: data.map((a) => ({
        id: a.id,
        categoryId: a.categoryId,
        points: a.points,
        level: a.level,
        order: a.order,
        name: { fr: a.nameFr, en: a.nameEn },
        description: a.descriptionFr ? { fr: a.descriptionFr } : null,
        img: a.img,
      })),
    };
  });

  // ── Quest categories ────────────────────────────────────────────────────────

  fastify.get('/quests/categories', async () => {
    const cats = await prisma.questCategory.findMany({
      orderBy: { nameFr: 'asc' },
      include: { _count: { select: { quests: true } } },
    });
    return cats.map((c) => ({
      id: c.id,
      name: { fr: c.nameFr },
      order: c.order,
      questCount: c._count.quests,
    }));
  });

  // ── Quests all (lightweight, for activity picker) ───────────────────────────

  fastify.get('/quests/all', async () => {
    const data = await prisma.quest.findMany({
      select: { id: true, nameFr: true, categoryId: true, levelMin: true, levelMax: true, isDungeonQuest: true, isPartyQuest: true, isEvent: true },
      orderBy: { id: 'asc' },
    });
    return data.map((q) => ({
      id: q.id,
      name: { fr: q.nameFr },
      categoryId: q.categoryId,
      levelMin: q.levelMin,
      levelMax: q.levelMax,
      isDungeonQuest: q.isDungeonQuest,
      isPartyQuest: q.isPartyQuest,
      isEvent: q.isEvent,
    }));
  });

  // ── Quests by IDs (batch) ───────────────────────────────────────────────────

  fastify.get('/quests/by-ids', async (request) => {
    const { ids } = request.query as { ids?: string };
    if (!ids) return [];
    const idList = ids.split(',').map(Number).filter((n) => !isNaN(n));
    if (!idList.length) return [];
    const data = await prisma.quest.findMany({
      where: { id: { in: idList } },
      select: { id: true, nameFr: true, categoryId: true, levelMin: true, levelMax: true, isDungeonQuest: true, isPartyQuest: true, isEvent: true },
    });
    return data.map((q) => ({
      id: q.id,
      name: { fr: q.nameFr },
      categoryId: q.categoryId,
      levelMin: q.levelMin,
      levelMax: q.levelMax,
      isDungeonQuest: q.isDungeonQuest,
      isPartyQuest: q.isPartyQuest,
      isEvent: q.isEvent,
    }));
  });

  // ── Quests ──────────────────────────────────────────────────────────────────

  fastify.get('/quests', async (request) => {
    const { categoryId, skip = '0', limit = '50', search } = request.query as {
      categoryId?: string;
      skip?: string;
      limit?: string;
      search?: string;
    };

    const where = {
      ...(categoryId ? { categoryId: Number(categoryId) } : {}),
      ...(search ? { nameFr: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.quest.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: Number(skip),
        take: Math.min(Number(limit), 100),
      }),
      prisma.quest.count({ where }),
    ]);

    return {
      total,
      skip: Number(skip),
      limit: Number(limit),
      data: data.map((q) => ({
        id: q.id,
        categoryId: q.categoryId,
        name: { fr: q.nameFr },
        levelMin: q.levelMin,
        levelMax: q.levelMax,
        isDungeonQuest: q.isDungeonQuest,
        isPartyQuest: q.isPartyQuest,
        repeatType: q.repeatType,
        stepIds: q.stepIds,
        followable: q.followable,
        isEvent: q.isEvent,
      })),
    };
  });

  // ── Sync status ─────────────────────────────────────────────────────────────

  fastify.get('/encyclopedia/status', async () => {
    const [achCatCount, achCount, qCatCount, qCount, lastAch] = await Promise.all([
      prisma.achievementCategory.count(),
      prisma.achievement.count(),
      prisma.questCategory.count(),
      prisma.quest.count(),
      prisma.achievement.findFirst({ orderBy: { syncedAt: 'desc' }, select: { syncedAt: true } }),
    ]);
    return {
      achievementCategories: achCatCount,
      achievements: achCount,
      questCategories: qCatCount,
      quests: qCount,
      lastSync: lastAch?.syncedAt ?? null,
      isSynced: achCount > 0 && qCount > 0,
    };
  });
}
