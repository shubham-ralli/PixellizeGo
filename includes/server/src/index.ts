import { env } from "@pixellize/core/env";
import { closeDb } from "@pixellize/database";
import { buildApp } from "./app.js";

const app = await buildApp();

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Received ${signal}, shutting down...`);
  await app.close();
  await closeDb();
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => void shutdown(sig));
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
