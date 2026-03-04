import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../../../domain/auth/AuthService';
import { authenticate } from '../middleware/authenticate';

const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  username: z.string().min(3, 'Min 3 caractères').max(30, 'Max 30 caractères'),
  password: z.string().min(6, 'Min 6 caractères'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & { authService: AuthService },
) {
  const { authService } = opts;

  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await authService.register(body.email, body.username, body.password);
    const token = fastify.jwt.sign({ userId: user.id, email: user.email, username: user.username });
    return reply.status(201).send({ user: user.toPublic(), token });
  });

  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await authService.login(body.email, body.password);
    const token = fastify.jwt.sign({ userId: user.id, email: user.email, username: user.username });
    return reply.send({ user: user.toPublic(), token });
  });

  fastify.get('/me', { onRequest: [authenticate] }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const user = await authService.getById(userId);
    if (!user) return reply.status(404).send({ error: 'Utilisateur introuvable' });
    return reply.send({ user: user.toPublic() });
  });
}
