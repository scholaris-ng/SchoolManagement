import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app';
import { env } from '../src/config/env';

/**
 * Compares the client's passthrough list against the API's real route table.
 *
 * The client mocks every endpoint and lets through only those it believes are
 * implemented (`client/src/mocks/live-routes.ts`). Those two lists drifting
 * apart fails in two directions, and the quiet one is worse:
 *
 *   - listed but not implemented  -> the user gets a 404 from Express
 *   - implemented but not listed  -> the screen silently keeps using fake data,
 *                                    and nobody notices the real endpoint is
 *                                    never called
 *
 * Run with `npm run check:live-routes -w @school/api` after adding a module.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

function serverRoutes(): Set<string> {
  const app = createApp();
  const found = new Set<string>();

  const walk = (stack: any[], prefix: string): void => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          if (layer.route.methods[method]) {
            found.add(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
          }
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const match = /^\^\\\/(.*?)\\\/\?/.exec(layer.regexp?.source ?? '');
        const mount = match ? '/' + match[1].replace(/\\\//g, '/') : '';
        walk(layer.handle.stack, prefix + mount);
      }
    }
  };

  walk((app as any)._router.stack, '');
  return found;
}

function clientRoutes(): Set<string> {
  const file = path.resolve(
    __dirname,
    '../../client/src/mocks/live-routes.ts',
  );
  const source = fs.readFileSync(file, 'utf8');

  // Only the tuples inside LIVE_ROUTES, so comments mentioning a path are not
  // mistaken for entries.
  const body = /const LIVE_ROUTES[^=]*=\s*\[([\s\S]*?)\n\];/.exec(source);
  if (!body) throw new Error('Could not find LIVE_ROUTES in live-routes.ts');

  const found = new Set<string>();
  for (const [, method, routePath] of body[1].matchAll(
    /\[\s*'(get|post|patch|delete)'\s*,\s*'([^']+)'\s*\]/g,
  )) {
    const full = routePath.startsWith('/api/') ? routePath : `${env.apiPrefix}${routePath}`;
    found.add(`${method.toUpperCase()} ${full}`);
  }
  return found;
}

const server = serverRoutes();
const client = clientRoutes();

const missingFromClient = [...server].filter((r) => !client.has(r)).sort();
const notOnServer = [...client].filter((r) => !server.has(r)).sort();

console.log(`server routes: ${server.size}`);
console.log(`client passthrough entries: ${client.size}`);

if (missingFromClient.length > 0) {
  console.log('\nImplemented but NOT passed through (screens still use mock data):');
  for (const r of missingFromClient) console.log('  +', r);
}

if (notOnServer.length > 0) {
  console.log('\nPassed through but NOT implemented (users will get a 404):');
  for (const r of notOnServer) console.log('  -', r);
}

if (missingFromClient.length === 0 && notOnServer.length === 0) {
  console.log('\nIn step — every implemented route is passed through, and no more.');
  process.exit(0);
}

process.exit(1);
