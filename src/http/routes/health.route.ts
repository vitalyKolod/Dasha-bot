import type { FastifyInstance } from 'fastify';
export function registerHealthRoute(server: FastifyInstance, environment: string): void {
  server.get('/health', () => ({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    environment,
  }));
}
