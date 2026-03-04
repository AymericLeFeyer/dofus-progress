import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { CharacterService } from '../../../domain/character/CharacterService';
import { CharacterClass, CHARACTER_CLASSES } from '../../../domain/character/Character.entity';
import { authenticate } from '../middleware/authenticate';

const createSchema = z.object({
  name: z.string().min(2, 'Min 2 caractères').max(20, 'Max 20 caractères'),
  characterClass: z.enum(CHARACTER_CLASSES as [string, ...string[]]),
  level: z.number().int().min(1).max(200).default(1),
});

const updateSchema = z.object({
  name: z.string().min(2).max(20).optional(),
  characterClass: z.enum(CHARACTER_CLASSES as [string, ...string[]]).optional(),
  level: z.number().int().min(1).max(200).optional(),
});

export async function characterRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { characterService: CharacterService },
) {
  const { characterService } = opts;

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { userId } = request.user as { userId: string };
    return characterService.getUserCharacters(userId);
  });

  fastify.post('/', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const body = createSchema.parse(request.body);
    const character = await characterService.createCharacter(userId, {
      userId,
      name: body.name,
      characterClass: body.characterClass as CharacterClass,
      level: body.level,
    });
    return reply.status(201).send(character);
  });

  fastify.put('/:id', async (request) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    return characterService.updateCharacter(userId, id, {
      name: body.name,
      characterClass: body.characterClass as CharacterClass | undefined,
      level: body.level,
    });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    await characterService.deleteCharacter(userId, id);
    return reply.status(204).send();
  });

  fastify.get('/classes', async () => {
    return CHARACTER_CLASSES;
  });
}
