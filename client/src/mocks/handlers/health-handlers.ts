import { http } from 'msw';
import { ok } from '../http-helpers';

/** Staff records for the ids a class's form-teacher field was set to, dropping any that don't resolve. */

/** Session, school settings, academic structure and roles. */

/** Health. */
export const healthhandlersHandlers = [

  http.get('/api/health/live', () => ok({ status: 'ok' })),
  http.get('/api/health/ready', () => ok({ status: 'ok', database: 'mock', firebase: 'mock' })),
];
