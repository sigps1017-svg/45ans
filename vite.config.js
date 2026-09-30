import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import teamApiHandler from './api/team.js';

function localTeamApi() {
  return {
    name: 'local-team-api',
    apply: 'serve',
    configureServer(server) {
      const localEnv = loadEnv(server.config.mode, process.cwd(), '');
      for (const key of [
        'SUPABASE_URL',
        'SUPABASE_SECRET_KEY',
        'VITE_SUPABASE_URL',
      ]) {
        if (!process.env[key] && localEnv[key]) process.env[key] = localEnv[key];
      }

      server.middlewares.use(async (request, response, next) => {
        if (new URL(request.url, 'http://localhost').pathname !== '/api/team') {
          next();
          return;
        }

        try {
          if (request.method === 'POST') {
            const chunks = [];
            let bodySize = 0;
            for await (const chunk of request) {
              bodySize += chunk.length;
              if (bodySize > 64 * 1024) {
                response.writeHead(413, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ error: 'Requête trop volumineuse.' }));
                return;
              }
              chunks.push(chunk);
            }
            const bodyText = Buffer.concat(chunks).toString('utf8');
            try {
              request.body = bodyText ? JSON.parse(bodyText) : null;
            } catch {
              response.writeHead(400, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ error: 'Corps de requête invalide.' }));
              return;
            }
          }

          let statusCode = 200;
          const responseHeaders = {};
          const responseAdapter = {
            status(status) {
              statusCode = status;
              return this;
            },
            setHeader(name, value) {
              responseHeaders[name] = value;
            },
            json(payload) {
              response.writeHead(statusCode, responseHeaders);
              response.end(JSON.stringify(payload));
            },
          };
          await teamApiHandler(request, responseAdapter);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [basicSsl(), localTeamApi()],
  server: {
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        accueil: resolve(import.meta.dirname, 'accueil.html'),
        gestion: resolve(import.meta.dirname, 'gestion.html'),
      },
    },
  },
});
