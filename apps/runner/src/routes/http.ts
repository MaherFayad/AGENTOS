/**
 * Shared HTTP helpers for the runner's routes.
 *
 * The only interesting thing here is that every route funnels failures through
 * `sendApiError`, so the uniform envelope (`{error:{code,message,hint?}}` with a real HTTP
 * status) is a property of the server rather than a convention each route remembers.
 */
import type { FastifyReply } from 'fastify';
import { ApiError, toApiError } from '../lib/errors';

export function sendApiError(reply: FastifyReply, err: unknown): FastifyReply {
  const apiError: ApiError = toApiError(err);
  return reply.code(apiError.status).send(apiError.toBody());
}

/** Wrap a handler so a thrown `ApiError` becomes the envelope, not a Fastify 500. */
export function guarded<Args extends unknown[]>(
  handler: (...args: [...Args, FastifyReply]) => Promise<unknown>,
): (...args: [...Args, FastifyReply]) => Promise<unknown> {
  return async (...args) => {
    const reply = args[args.length - 1] as FastifyReply;
    try {
      return await handler(...args);
    } catch (err) {
      return sendApiError(reply, err);
    }
  };
}
