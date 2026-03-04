import { FastifyInstance } from 'fastify';
import { prisma } from '../../../infrastructure/prisma/client';
import { authenticate } from '../middleware/authenticate';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function buildProgressForCharacter(characterId: string) {
  const [questRows, achRows] = await Promise.all([
    prisma.characterQuestProgress.findMany({ where: { characterId }, select: { questId: true, status: true } }),
    prisma.characterAchievementProgress.findMany({ where: { characterId }, select: { achievementId: true } }),
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

  return {
    completedQuestIds,
    startedQuestIds,
    blockedQuestIds,
    completedAchievementIds,
    totalPoints,
    achievementCategoryProgress,
    // Alias pour la compat frontend existant
    questCategoryProgress: completedQuestCategoryProgress,
    completedQuestCategoryProgress,
    startedQuestCategoryProgress,
    blockedQuestCategoryProgress,
  };
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

  // GET /api/profile/:characterId → profil public (tout utilisateur authentifié)
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

  // GET /api/guild-progress/:guildId → progression de tous les membres
  fastify.get<{ Params: { guildId: string } }>(
    '/guild-progress/:guildId',
    { onRequest: [authenticate] },
    async (request, reply) => {
      const { guildId } = request.params;
      const { userId } = request.user as { userId: string };

      // Vérifier que l'utilisateur est membre de cette guilde
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
          const progress = await buildProgressForCharacter(m.characterId);
          return {
            characterId: m.characterId,
            name: m.character.name,
            class: m.character.class,
            level: m.character.level,
            role: m.role,
            ...progress,
          };
        }),
      );

      return { members: membersWithProgress };
    },
  );

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

      // completed → supprimer
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

      // Récupérer les quêtes liées à ce succès
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
