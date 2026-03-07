import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/prisma/client';
import { authenticate } from '../middleware/authenticate';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function buildProgressForCharacter(characterId: string) {
  const [questRows, achRows, dungeonRows] = await Promise.all([
    prisma.characterQuestProgress.findMany({ where: { characterId }, select: { questId: true, status: true } }),
    prisma.characterAchievementProgress.findMany({ where: { characterId }, select: { achievementId: true } }),
    prisma.characterDungeonProgress.findMany({ where: { characterId }, select: { dungeonId: true, isTodo: true, isDone: true } }),
  ]);

  const completedQuestIds = questRows.filter((r) => r.status === 'completed').map((r) => r.questId);
  const startedQuestIds = questRows.filter((r) => r.status === 'started').map((r) => r.questId);
  const blockedQuestIds = questRows.filter((r) => r.status === 'blocked').map((r) => r.questId);
  const completedAchievementIds = achRows.map((r) => r.achievementId);

  const [achWithCats, completedQuestWithCats, startedQuestWithCats, blockedQuestWithCats] = await Promise.all([
    completedAchievementIds.length > 0
      ? prisma.achievement.findMany({
          where: { id: { in: completedAchievementIds } },
          select: { categoryId: true, points: true },
        })
      : [],
    completedQuestIds.length > 0
      ? prisma.quest.findMany({ where: { id: { in: completedQuestIds } }, select: { categoryId: true } })
      : [],
    startedQuestIds.length > 0
      ? prisma.quest.findMany({ where: { id: { in: startedQuestIds } }, select: { categoryId: true } })
      : [],
    blockedQuestIds.length > 0
      ? prisma.quest.findMany({ where: { id: { in: blockedQuestIds } }, select: { categoryId: true } })
      : [],
  ]);

  const totalPoints = (achWithCats as { categoryId: number; points: number }[]).reduce((sum, a) => sum + a.points, 0);

  const achievementCategoryProgress: Record<number, number> = {};
  (achWithCats as { categoryId: number; points: number }[]).forEach((a) => {
    achievementCategoryProgress[a.categoryId] = (achievementCategoryProgress[a.categoryId] ?? 0) + 1;
  });

  const completedQuestCategoryProgress: Record<number, number> = {};
  (completedQuestWithCats as { categoryId: number }[]).forEach((q) => {
    completedQuestCategoryProgress[q.categoryId] = (completedQuestCategoryProgress[q.categoryId] ?? 0) + 1;
  });

  const startedQuestCategoryProgress: Record<number, number> = {};
  (startedQuestWithCats as { categoryId: number }[]).forEach((q) => {
    startedQuestCategoryProgress[q.categoryId] = (startedQuestCategoryProgress[q.categoryId] ?? 0) + 1;
  });

  const blockedQuestCategoryProgress: Record<number, number> = {};
  (blockedQuestWithCats as { categoryId: number }[]).forEach((q) => {
    blockedQuestCategoryProgress[q.categoryId] = (blockedQuestCategoryProgress[q.categoryId] ?? 0) + 1;
  });

  const todoDungeonIds = dungeonRows.filter((r) => r.isTodo).map((r) => r.dungeonId);
  const doneDungeonIds = dungeonRows.filter((r) => r.isDone).map((r) => r.dungeonId);

  return {
    completedQuestIds,
    startedQuestIds,
    blockedQuestIds,
    completedAchievementIds,
    totalPoints,
    achievementCategoryProgress,
    questCategoryProgress: completedQuestCategoryProgress,
    completedQuestCategoryProgress,
    startedQuestCategoryProgress,
    blockedQuestCategoryProgress,
    todoDungeonIds,
    doneDungeonIds,
  };
}

// Summary allégé pour guild-progress (pas les listes complètes de complétions)
async function buildGuildMemberSummary(characterId: string) {
  const [questRows, achRows, dungeonRows] = await Promise.all([
    prisma.characterQuestProgress.findMany({ where: { characterId }, select: { questId: true, status: true } }),
    prisma.characterAchievementProgress.findMany({ where: { characterId }, select: { achievementId: true } }),
    prisma.characterDungeonProgress.findMany({ where: { characterId }, select: { dungeonId: true, isTodo: true } }),
  ]);

  const blockedQuestIds = questRows.filter((r) => r.status === 'blocked').map((r) => r.questId);
  const achievementIds = achRows.map((r) => r.achievementId);

  let totalPoints = 0;
  if (achievementIds.length > 0) {
    const achs = await prisma.achievement.findMany({
      where: { id: { in: achievementIds } },
      select: { points: true },
    });
    totalPoints = achs.reduce((sum, a) => sum + a.points, 0);
  }

  return {
    totalPoints,
    achievementCount: achievementIds.length,
    completedQuestCount: questRows.filter((r) => r.status === 'completed').length,
    startedQuestCount: questRows.filter((r) => r.status === 'started').length,
    startedQuestIds: questRows.filter((r) => r.status === 'started').map((r) => r.questId),
    blockedQuestCount: blockedQuestIds.length,
    blockedQuestIds,
    todoDungeonIds: dungeonRows.filter((r) => r.isTodo).map((r) => r.dungeonId),
  };
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function progressRoutes(fastify: FastifyInstance) {
  // GET /api/progress/:characterId
  fastify.get<{ Params: { characterId: string } }>(
    '/progress/:characterId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId } = request.params;
      const { userId } = request.user as { userId: string };
      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });
      return buildProgressForCharacter(characterId);
    },
  );

  // GET /api/profile/:characterId → profil public
  fastify.get<{ Params: { characterId: string } }>(
    '/profile/:characterId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId } = request.params;
      const character = await prisma.character.findFirst({
        where: { id: characterId },
        include: { guildMember: { include: { guild: { select: { id: true, name: true, imageUrl: true } } } } },
      });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });
      const progress = await buildProgressForCharacter(characterId);
      return {
        character: {
          id: character.id,
          name: character.name,
          class: character.class,
          level: character.level,
          guild: character.guildMember
            ? { id: character.guildMember.guild.id, name: character.guildMember.guild.name, imageUrl: character.guildMember.guild.imageUrl }
            : null,
        },
        ...progress,
      };
    },
  );

  // GET /api/progress → points pour tous les personnages de l'utilisateur
  fastify.get('/progress', { onRequest: [authenticate] }, async (request) => {
    const { userId } = request.user as { userId: string };
    const characters = await prisma.character.findMany({ where: { userId }, select: { id: true } });
    return Promise.all(
      characters.map(async ({ id: characterId }) => {
        const achRows = await prisma.characterAchievementProgress.findMany({
          where: { characterId },
          select: { achievementId: true },
        });
        const ids = achRows.map((r) => r.achievementId);
        let totalPoints = 0;
        if (ids.length > 0) {
          const achs = await prisma.achievement.findMany({
            where: { id: { in: ids } },
            select: { points: true },
          });
          totalPoints = achs.reduce((sum, a) => sum + a.points, 0);
        }
        return { characterId, totalPoints };
      }),
    );
  });

  // GET /api/guild-progress/:guildId → résumé de tous les membres (allégé)
  fastify.get<{ Params: { guildId: string } }>(
    '/guild-progress/:guildId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { guildId } = request.params;
      const { userId } = request.user as { userId: string };

      const userChars = await prisma.character.findMany({ where: { userId }, select: { id: true } });
      const userCharIds = userChars.map((c) => c.id);
      const membership = await prisma.guildMember.findFirst({
        where: { guildId, characterId: { in: userCharIds } },
      });
      if (!membership) return reply.status(403).send({ error: 'Non membre de cette guilde' });

      const members = await prisma.guildMember.findMany({
        where: { guildId },
        include: { character: { select: { id: true, name: true, class: true, level: true } } },
      });

      const membersWithProgress = await Promise.all(
        members.map(async (m) => {
          const summary = await buildGuildMemberSummary(m.characterId);
          return {
            characterId: m.characterId,
            name: m.character.name,
            class: m.character.class,
            level: m.character.level,
            role: m.role,
            ...summary,
          };
        }),
      );

      return { members: membersWithProgress };
    },
  );

  // POST /api/guild-activity → suggestions d'activité pour un groupe de personnages
  const guildActivitySchema = z.object({
    characterIds: z.array(z.string()).min(1).max(50),
    types: z.array(z.enum(['quests', 'dungeons', 'achievements'])).min(1),
    beneficialToAll: z.boolean(),
    count: z.number().int().min(1).max(20),
    allDungeonIds: z.array(z.number().int()).optional().default([]),
  });

  fastify.post('/guild-activity', { onRequest: [authenticate] }, async (request, reply) => {
    const parsed = guildActivitySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Données invalides', details: parsed.error.errors });

    const { characterIds, types, beneficialToAll, count, allDungeonIds } = parsed.data;
    const { userId } = request.user as { userId: string };

    // Vérifier que l'utilisateur est membre de la même guilde que les personnages demandés
    const userChars = await prisma.character.findMany({ where: { userId }, select: { id: true } });
    const userCharIds = new Set(userChars.map((c) => c.id));

    const members = await prisma.guildMember.findMany({
      where: { characterId: { in: characterIds } },
      select: {
        guildId: true,
        characterId: true,
        character: { select: { name: true, class: true } },
      },
    });

    if (members.length === 0) return reply.status(400).send({ error: 'Aucun personnage valide' });

    const guildIds = [...new Set(members.map((m) => m.guildId))];
    if (guildIds.length > 1) return reply.status(400).send({ error: 'Les personnages doivent être dans la même guilde' });

    const guildId = guildIds[0];
    const isMember = await prisma.guildMember.findFirst({
      where: { guildId, characterId: { in: [...userCharIds] } },
    });
    if (!isMember) return reply.status(403).send({ error: 'Non membre de cette guilde' });

    const charInfoMap = new Map(
      members.map((m) => [m.characterId, { name: m.character.name, class: m.character.class }]),
    );

    // Récupérer la progression de chaque personnage
    const progressData = await Promise.all(
      characterIds.map(async (characterId) => {
        const [questRows, achRows, dungeonRows] = await Promise.all([
          prisma.characterQuestProgress.findMany({
            where: { characterId, status: 'completed' },
            select: { questId: true },
          }),
          prisma.characterAchievementProgress.findMany({
            where: { characterId },
            select: { achievementId: true },
          }),
          prisma.characterDungeonProgress.findMany({
            where: { characterId, isDone: true },
            select: { dungeonId: true },
          }),
        ]);
        return {
          characterId,
          completedQuestIds: new Set(questRows.map((r) => r.questId)),
          completedAchIds: new Set(achRows.map((r) => r.achievementId)),
          doneDungeonIds: new Set(dungeonRows.map((r) => r.dungeonId)),
        };
      }),
    );

    // Calcule les neededBy pour un item donné
    function getNeededBy(id: number, needsFn: (pd: typeof progressData[0]) => boolean) {
      return progressData
        .filter((pd) => needsFn(pd))
        .map((pd) => ({
          characterId: pd.characterId,
          name: charInfoMap.get(pd.characterId)!.name,
          class: charInfoMap.get(pd.characterId)!.class,
        }));
    }

    // Calcule les IDs exclus selon beneficialToAll
    function buildExcludedIds(completedSets: Set<number>[]): Set<number> {
      if (beneficialToAll) {
        // Exclure si AU MOINS UN personnage a complété → union
        const excluded = new Set<number>();
        completedSets.forEach((s) => s.forEach((id) => excluded.add(id)));
        return excluded;
      } else {
        // Exclure si TOUS les personnages ont complété → intersection
        if (completedSets.length === 0) return new Set();
        const counts = new Map<number, number>();
        completedSets.forEach((s) => s.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1)));
        const excluded = new Set<number>();
        counts.forEach((c, id) => { if (c === completedSets.length) excluded.add(id); });
        return excluded;
      }
    }

    const result: Record<string, unknown> = {};

    if (types.includes('quests')) {
      const excludedQuestIds = buildExcludedIds(progressData.map((pd) => pd.completedQuestIds));
      const allQuests = await prisma.quest.findMany({
        where: excludedQuestIds.size > 0 ? { id: { notIn: [...excludedQuestIds] } } : undefined,
        select: {
          id: true, nameFr: true, categoryId: true,
          levelMin: true, levelMax: true,
          isDungeonQuest: true, isPartyQuest: true, isEvent: true,
        },
      });
      const picked = shuffle(allQuests).slice(0, count);
      result.quests = picked.map((q) => ({
        id: q.id,
        name: { fr: q.nameFr },
        categoryId: q.categoryId,
        levelMin: q.levelMin,
        levelMax: q.levelMax,
        isDungeonQuest: q.isDungeonQuest,
        isPartyQuest: q.isPartyQuest,
        isEvent: q.isEvent,
        neededBy: getNeededBy(q.id, (pd) => !pd.completedQuestIds.has(q.id)),
      }));
    }

    if (types.includes('achievements')) {
      const excludedAchIds = buildExcludedIds(progressData.map((pd) => pd.completedAchIds));
      const allAchs = await prisma.achievement.findMany({
        where: excludedAchIds.size > 0 ? { id: { notIn: [...excludedAchIds] } } : undefined,
        select: { id: true, nameFr: true, categoryId: true, points: true, level: true, img: true },
      });
      const picked = shuffle(allAchs).slice(0, count);
      result.achievements = picked.map((a) => ({
        id: a.id,
        name: { fr: a.nameFr },
        categoryId: a.categoryId,
        points: a.points,
        level: a.level,
        img: a.img,
        neededBy: getNeededBy(a.id, (pd) => !pd.completedAchIds.has(a.id)),
      }));
    }

    if (types.includes('dungeons') && allDungeonIds.length > 0) {
      const excludedDungeonIds = buildExcludedIds(progressData.map((pd) => pd.doneDungeonIds));
      const eligibleDungeonIds = allDungeonIds.filter((id) => !excludedDungeonIds.has(id));
      const picked = shuffle(eligibleDungeonIds).slice(0, count);
      result.dungeons = picked.map((id) => ({
        id,
        neededBy: getNeededBy(id, (pd) => !pd.doneDungeonIds.has(id)),
      }));
    }

    return result;
  });

  // POST /api/progress/:characterId/quest/:questId → toggle 3 états
  fastify.post<{ Params: { characterId: string; questId: string } }>(
    '/progress/:characterId/quest/:questId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId, questId } = request.params;
      const { userId } = request.user as { userId: string };
      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });

      const existing = await prisma.characterQuestProgress.findUnique({
        where: { characterId_questId: { characterId, questId: Number(questId) } },
      });

      if (!existing) {
        await prisma.characterQuestProgress.create({
          data: { characterId, questId: Number(questId), status: 'started' },
        });
        return { status: 'started' };
      }

      if (existing.status === 'started') {
        await prisma.characterQuestProgress.update({
          where: { characterId_questId: { characterId, questId: Number(questId) } },
          data: { status: 'completed' },
        });
        return { status: 'completed' };
      }

      await prisma.characterQuestProgress.delete({
        where: { characterId_questId: { characterId, questId: Number(questId) } },
      });
      return { status: 'todo' };
    },
  );

  // PUT /api/progress/:characterId/quest/:questId → set status direct
  fastify.put<{ Params: { characterId: string; questId: string }; Body: { status: string } }>(
    '/progress/:characterId/quest/:questId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId, questId } = request.params;
      const { status } = request.body;
      const { userId } = request.user as { userId: string };

      const allowed = ['started', 'completed', 'blocked', 'todo'];
      if (!allowed.includes(status)) return reply.status(400).send({ error: 'Statut invalide' });

      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });

      if (status === 'todo') {
        await prisma.characterQuestProgress.deleteMany({
          where: { characterId, questId: Number(questId) },
        });
      } else {
        await prisma.characterQuestProgress.upsert({
          where: { characterId_questId: { characterId, questId: Number(questId) } },
          create: { characterId, questId: Number(questId), status },
          update: { status },
        });
      }
      return { status };
    },
  );

  // POST /api/progress/:characterId/achievement/:achievementId → toggle
  fastify.post<{ Params: { characterId: string; achievementId: string } }>(
    '/progress/:characterId/achievement/:achievementId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId, achievementId } = request.params;
      const { userId } = request.user as { userId: string };
      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });

      const existing = await prisma.characterAchievementProgress.findUnique({
        where: { characterId_achievementId: { characterId, achievementId: Number(achievementId) } },
      });
      if (existing) {
        await prisma.characterAchievementProgress.delete({
          where: { characterId_achievementId: { characterId, achievementId: Number(achievementId) } },
        });
        return { completed: false, cascadedQuestIds: [] };
      }

      const achievement = await prisma.achievement.findUnique({
        where: { id: Number(achievementId) },
        select: { questIds: true },
      });
      const linkedQuestIds = achievement?.questIds ?? [];

      await prisma.$transaction([
        prisma.characterAchievementProgress.create({
          data: { characterId, achievementId: Number(achievementId) },
        }),
        ...linkedQuestIds.map((questId) =>
          prisma.characterQuestProgress.upsert({
            where: { characterId_questId: { characterId, questId } },
            create: { characterId, questId, status: 'completed' },
            update: { status: 'completed' },
          }),
        ),
      ]);
      return { completed: true, cascadedQuestIds: linkedQuestIds };
    },
  );

  // POST /api/progress/:characterId/achievement/category/:categoryId/all → valider tout
  fastify.post<{ Params: { characterId: string; categoryId: string } }>(
    '/progress/:characterId/achievement/category/:categoryId/all',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId, categoryId } = request.params;
      const { userId } = request.user as { userId: string };
      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });

      const achievements = await prisma.achievement.findMany({
        where: { categoryId: Number(categoryId) },
        select: { id: true, questIds: true },
      });

      const allQuestIds = [...new Set(achievements.flatMap((a) => a.questIds))];

      await prisma.$transaction([
        ...achievements.map((a) =>
          prisma.characterAchievementProgress.upsert({
            where: { characterId_achievementId: { characterId, achievementId: a.id } },
            create: { characterId, achievementId: a.id },
            update: {},
          }),
        ),
        ...allQuestIds.map((questId) =>
          prisma.characterQuestProgress.upsert({
            where: { characterId_questId: { characterId, questId } },
            create: { characterId, questId, status: 'completed' },
            update: { status: 'completed' },
          }),
        ),
      ]);
      return { count: achievements.length, cascadedQuestCount: allQuestIds.length };
    },
  );

  // PUT /api/progress/:characterId/dungeon/:dungeonId → set isTodo / isDone
  fastify.put<{ Params: { characterId: string; dungeonId: string }; Body: { isTodo?: boolean; isDone?: boolean } }>(
    '/progress/:characterId/dungeon/:dungeonId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId, dungeonId } = request.params;
      const { isTodo, isDone } = request.body;
      const { userId } = request.user as { userId: string };
      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });

      const existing = await prisma.characterDungeonProgress.findUnique({
        where: { characterId_dungeonId: { characterId, dungeonId: Number(dungeonId) } },
      });
      const newIsTodo = isTodo !== undefined ? isTodo : (existing?.isTodo ?? false);
      const newIsDone = isDone !== undefined ? isDone : (existing?.isDone ?? false);

      if (!newIsTodo && !newIsDone) {
        await prisma.characterDungeonProgress.deleteMany({ where: { characterId, dungeonId: Number(dungeonId) } });
      } else {
        await prisma.characterDungeonProgress.upsert({
          where: { characterId_dungeonId: { characterId, dungeonId: Number(dungeonId) } },
          create: { characterId, dungeonId: Number(dungeonId), isTodo: newIsTodo, isDone: newIsDone },
          update: { isTodo: newIsTodo, isDone: newIsDone },
        });
      }
      return { isTodo: newIsTodo, isDone: newIsDone };
    },
  );

  // POST /api/progress/:characterId/quest/category/:categoryId/all → valider tout
  fastify.post<{ Params: { characterId: string; categoryId: string } }>(
    '/progress/:characterId/quest/category/:categoryId/all',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { characterId, categoryId } = request.params;
      const { userId } = request.user as { userId: string };
      const character = await prisma.character.findFirst({ where: { id: characterId, userId } });
      if (!character) return reply.status(404).send({ error: 'Personnage introuvable' });

      const quests = await prisma.quest.findMany({
        where: { categoryId: Number(categoryId) },
        select: { id: true },
      });
      await prisma.$transaction(
        quests.map((q) =>
          prisma.characterQuestProgress.upsert({
            where: { characterId_questId: { characterId, questId: q.id } },
            create: { characterId, questId: q.id, status: 'completed' },
            update: { status: 'completed' },
          }),
        ),
      );
      return { count: quests.length };
    },
  );
}
