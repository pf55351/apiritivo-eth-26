import type { FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export async function registerWeb(api: FastifyInstance, development: boolean) {
  const root = fileURLToPath(new URL("../../web/", import.meta.url));
  if (development) {
    const { createServer } = await import("vite");
    const { default: middie } = await import("@fastify/middie");
    await api.register(middie);
    const vite = await createServer({
      root,
      configFile: resolve(root, "vite.config.ts"),
      server: { middlewareMode: true, ws: { server: api.server } },
      appType: "spa",
    });
    api.use((req, res, next) => {
      if (req.url?.startsWith("/api/") || req.url?.startsWith("/health"))
        return next();
      vite.middlewares(req, res, next);
    });
    api.addHook("onClose", async () => {
      await vite.close();
    });
  } else {
    const { default: staticFiles } = await import("@fastify/static");
    await api.register(staticFiles, {
      root: resolve(root, "dist"),
      prefix: "/",
      index: ["index.html"],
    });
    api.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/") || request.method !== "GET")
        return reply.code(404).send({ error: { code: "NOT_FOUND" } });
      return reply.sendFile("index.html");
    });
  }
}
