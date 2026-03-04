import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { GuildService } from '../../../domain/guild/GuildService';
import { authenticate } from '../middleware/authenticate';

const createGuildSchema = z.object({
  name: z.string().min(2, 'Min 2 caractères').max(30, 'Max 30 caractères'),
  leaderCharacterId: z.string().cuid(),
  imageUrl: z.string().url().optional(),
});

const inviteSchema = z.object({
  characterName: z.string().min(1),
});

export async function guildRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { guildService: GuildService },
) {
  const { guildService } = opts;

  fastify.addHook('onRequest', authenticate);

  // Créer une guilde
  fastify.post('/guilds', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const body = createGuildSchema.parse(request.body);
    const guild = await guildService.createGuild(userId, body.leaderCharacterId, body.name, body.imageUrl);
    return reply.status(201).send(guild);
  });

  // Récupérer une guilde avec ses membres
  fastify.get('/guilds/:id', async (request) => {
    const { id } = request.params as { id: string };
    return guildService.getGuild(id);
  });

  // Inviter un personnage dans la guilde
  fastify.post('/guilds/:id/invite', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = inviteSchema.parse(request.body);
    await guildService.inviteCharacter(userId, id, body.characterName);
    return reply.status(201).send({ message: 'Invitation envoyée' });
  });

  // Retirer un membre
  fastify.delete('/guilds/:guildId/members/:characterId', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { guildId, characterId } = request.params as { guildId: string; characterId: string };
    await guildService.removeMember(userId, guildId, characterId);
    return reply.status(204).send();
  });

  // Mes invitations en attente
  fastify.get('/invitations', async (request) => {
    const { userId } = request.user as { userId: string };
    return guildService.getPendingInvitationsForUser(userId);
  });

  // Accepter une invitation
  fastify.post('/invitations/:token/accept', async (request) => {
    const { userId } = request.user as { userId: string };
    const { token } = request.params as { token: string };
    await guildService.acceptInvitation(userId, token);
    return { message: 'Invitation acceptée' };
  });

  // Décliner une invitation
  fastify.post('/invitations/:token/decline', async (request) => {
    const { userId } = request.user as { userId: string };
    const { token } = request.params as { token: string };
    await guildService.declineInvitation(userId, token);
    return { message: 'Invitation refusée' };
  });
}
