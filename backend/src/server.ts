import { buildApp } from './app';

const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';

async function start() {
  const app = buildApp();

  try {
    await app.listen({ port, host });
    console.log(`Server running on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
