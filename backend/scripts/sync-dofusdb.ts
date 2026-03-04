/**
 * Script de synchronisation DofusDB → PostgreSQL
 * Usage : npm run sync:dofusdb
 * Idempotent : peut être relancé pour mettre à jour les données.
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const api = axios.create({
  baseURL: 'https://api.dofusdb.fr',
  params: { lang: 'fr' },
  timeout: 15_000,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function bar(current: number, total: number, width = 30): string {
  const filled = Math.round((current / total) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

function progress(label: string, current: number, total: number) {
  process.stdout.write(`\r  ${bar(current, total)} ${current}/${total}  ${label}   `);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function apiGetWithRetry<T>(
  endpoint: string,
  params: Record<string, unknown>,
  attempts = 3,
): Promise<{ total: number; data: T[] }> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { data } = await api.get<{ total: number; data: T[] }>(endpoint, { params });
      return data;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(500 * (i + 1));
    }
  }
  throw new Error('unreachable');
}

async function fetchAll<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const LIMIT = 50;
  const all: T[] = [];

  // First page
  const first = await apiGetWithRetry<T>(endpoint, { $limit: LIMIT, $skip: 0, ...params });
  const total = first.total;
  all.push(...first.data);
  progress(endpoint, all.length, total);

  // Remaining pages — use all.length as skip to handle partial pages correctly
  while (all.length < total) {
    await sleep(150);
    const page = await apiGetWithRetry<T>(endpoint, { $limit: LIMIT, $skip: all.length, ...params });
    if (page.data.length === 0) break; // safety: avoid infinite loop on empty page
    all.push(...page.data);
    progress(endpoint, all.length, total);
  }

  process.stdout.write('\n');
  return all;
}

async function batchUpsert<T>(
  label: string,
  items: T[],
  upsertFn: (item: T) => Promise<unknown>,
  batchSize = 50,
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await prisma.$transaction(batch.map((item) => upsertFn(item) as any));
    progress(label, Math.min(i + batchSize, items.length), items.length);
  }
  process.stdout.write('\n');
}

// ── Sync functions ────────────────────────────────────────────────────────────

async function syncAchievementCategories() {
  console.log('\n📁 Catégories de succès...');
  const cats = await fetchAll<any>('/achievement-categories', { '$sort[order]': 1 });

  // Roots first (parentId=0), then children, to satisfy potential FK constraints
  const sorted = [
    ...cats.filter((c: any) => c.parentId === 0),
    ...cats.filter((c: any) => c.parentId !== 0),
  ];

  await batchUpsert('  upsert', sorted, (cat) =>
    prisma.achievementCategory.upsert({
      where: { id: cat.id },
      create: {
        id: cat.id,
        parentId: cat.parentId ?? 0,
        nameFr: cat.name?.fr ?? '',
        nameEn: cat.name?.en ?? '',
        color: cat.color ?? null,
        icon: cat.icon ?? null,
        order: cat.order ?? 0,
      },
      update: {
        parentId: cat.parentId ?? 0,
        nameFr: cat.name?.fr ?? '',
        nameEn: cat.name?.en ?? '',
        color: cat.color ?? null,
        icon: cat.icon ?? null,
        order: cat.order ?? 0,
      },
    }),
  );

  console.log(`  ✅ ${cats.length} catégories`);
  return cats.length;
}

async function syncAchievements() {
  console.log('\n🏆 Succès...');
  const achievements = await fetchAll<any>('/achievements', { '$sort[id]': 1 });

  // Filter out achievements whose categoryId doesn't exist in DB
  const validCatIds = new Set(
    (await prisma.achievementCategory.findMany({ select: { id: true } })).map((c) => c.id),
  );
  const valid = achievements.filter((a: any) => validCatIds.has(a.categoryId));
  const skipped = achievements.length - valid.length;
  if (skipped > 0) console.log(`  ⚠️  ${skipped} succès ignorés (catégorie inconnue)`);

  await batchUpsert('  upsert', valid, (ach) =>
    prisma.achievement.upsert({
      where: { id: ach.id },
      create: {
        id: ach.id,
        categoryId: ach.categoryId,
        points: ach.points ?? 0,
        level: ach.level ?? 0,
        order: ach.order ?? 0,
        nameFr: ach.name?.fr ?? '',
        nameEn: ach.name?.en ?? '',
        descriptionFr: ach.description?.fr ?? null,
        img: ach.img ?? null,
      },
      update: {
        categoryId: ach.categoryId,
        points: ach.points ?? 0,
        level: ach.level ?? 0,
        order: ach.order ?? 0,
        nameFr: ach.name?.fr ?? '',
        nameEn: ach.name?.en ?? '',
        descriptionFr: ach.description?.fr ?? null,
        img: ach.img ?? null,
        syncedAt: new Date(),
      },
    }),
  );

  console.log(`  ✅ ${valid.length} succès`);
  return valid.length;
}

async function syncQuestCategories() {
  console.log('\n📚 Catégories de quêtes...');
  const cats = await fetchAll<any>('/quest-categories', { '$sort[order]': 1 });

  await batchUpsert('  upsert', cats, (cat) =>
    prisma.questCategory.upsert({
      where: { id: cat.id },
      create: {
        id: cat.id,
        nameFr: cat.name?.fr ?? '',
        order: cat.order ?? 0,
      },
      update: {
        nameFr: cat.name?.fr ?? '',
        order: cat.order ?? 0,
      },
    }),
  );

  console.log(`  ✅ ${cats.length} catégories`);
  return cats.length;
}

async function syncQuests() {
  console.log('\n📜 Quêtes...');
  const quests = await fetchAll<any>('/quests', { '$sort[id]': 1 });

  const validCatIds = new Set(
    (await prisma.questCategory.findMany({ select: { id: true } })).map((c) => c.id),
  );
  const valid = quests.filter((q: any) => validCatIds.has(q.categoryId));
  const skipped = quests.length - valid.length;
  if (skipped > 0) console.log(`  ⚠️  ${skipped} quêtes ignorées (catégorie inconnue)`);

  await batchUpsert('  upsert', valid, (q) =>
    prisma.quest.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        categoryId: q.categoryId,
        nameFr: q.name?.fr ?? '',
        levelMin: q.levelMin ?? 0,
        levelMax: q.levelMax ?? 0,
        isDungeonQuest: q.isDungeonQuest ?? false,
        isPartyQuest: q.isPartyQuest ?? false,
        repeatType: q.repeatType ?? 0,
        stepIds: q.stepIds ?? [],
        followable: q.followable ?? false,
        isEvent: q.isEvent ?? false,
      },
      update: {
        categoryId: q.categoryId,
        nameFr: q.name?.fr ?? '',
        levelMin: q.levelMin ?? 0,
        levelMax: q.levelMax ?? 0,
        isDungeonQuest: q.isDungeonQuest ?? false,
        isPartyQuest: q.isPartyQuest ?? false,
        repeatType: q.repeatType ?? 0,
        stepIds: q.stepIds ?? [],
        followable: q.followable ?? false,
        isEvent: q.isEvent ?? false,
        syncedAt: new Date(),
      },
    }),
  );

  console.log(`  ✅ ${valid.length} quêtes`);
  return valid.length;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║   DofusDB → PostgreSQL Sync        ║');
  console.log('╚════════════════════════════════════╝');
  console.log(`  API: https://api.dofusdb.fr`);
  console.log(`  DB:  ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://*****@')}`);

  const start = Date.now();

  try {
    const catCount = await syncAchievementCategories();
    const achCount = await syncAchievements();
    const qCatCount = await syncQuestCategories();
    const qCount = await syncQuests();

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n╔════════════════════════════════════╗');
    console.log('║   Sync terminée avec succès ✅      ║');
    console.log('╠════════════════════════════════════╣');
    console.log(`║  Catégories succès : ${String(catCount).padStart(6)}          ║`);
    console.log(`║  Succès            : ${String(achCount).padStart(6)}          ║`);
    console.log(`║  Catégories quêtes : ${String(qCatCount).padStart(6)}          ║`);
    console.log(`║  Quêtes            : ${String(qCount).padStart(6)}          ║`);
    console.log(`║  Durée             : ${String(elapsed + 's').padStart(6)}          ║`);
    console.log('╚════════════════════════════════════╝');
  } catch (err) {
    console.error('\n❌ Erreur durant la sync:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
