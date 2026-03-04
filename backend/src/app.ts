import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { prisma } from './infrastructure/prisma/client';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { PrismaCharacterRepository } from './infrastructure/repositories/PrismaCharacterRepository';
import { PrismaGuildRepository } from './infrastructure/repositories/PrismaGuildRepository';
import { AuthService } from './domain/auth/AuthService';
import { CharacterService } from './domain/character/CharacterService';
import { GuildService } from './domain/guild/GuildService';
import { authRoutes } from './infrastructure/http/routes/auth.routes';
import { characterRoutes } from './infrastructure/http/routes/character.routes';
import { guildRoutes } from './infrastructure/http/routes/guild.routes';
import { encyclopediaRoutes } from './infrastructure/http/routes/encyclopedia.routes';
import { progressRoutes } from './infrastructure/http/routes/progress.routes';
import { AppError } from './shared/errors/AppError';
import { ZodError } from 'zod';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  // Plugins
  app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  });

  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
  });

  // Dependency injection
  const userRepository = new PrismaUserRepository(prisma);
  const characterRepository = new PrismaCharacterRepository(prisma);
  const guildRepository = new PrismaGuildRepository(prisma);

  const authService = new AuthService(userRepository);
  const characterService = new CharacterService(characterRepository);
  const guildService = new GuildService(guildRepository, characterRepository);

  // Routes
  app.register(authRoutes, { prefix: '/api/auth', authService });
  app.register(characterRoutes, { prefix: '/api/characters', characterService });
  app.register(guildRoutes, { prefix: '/api', guildService });
  app.register(encyclopediaRoutes, { prefix: '/api' });
  app.register(progressRoutes, { prefix: '/api' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'Données invalides',
        details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: 'Erreur interne du serveur' });
  });

  return app;
}
