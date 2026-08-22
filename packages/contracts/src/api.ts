import { defineEndpoint, type AnyEndpoint } from './endpoint.js';
import { okSchema } from './common.js';
import {
  authSessionSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  userSchema,
} from './auth.js';
import { catalogSchema } from './catalog.js';
import {
  collectionOverviewSchema,
  createGameSchema,
  gameListQuerySchema,
  gameListSchema,
  gameSchema,
  updateGameSchema,
  uploadResultSchema,
} from './game.js';

/** The prefix under which NestJS mounts the whole REST API. */
export const API_PREFIX = '/api';

/** Cookie holding the refresh token (httpOnly, set by the backend). */
export const REFRESH_COOKIE_NAME = 'gs_refresh';

/**
 * The single inventory of the application's endpoints.
 *
 * NestJS takes the paths for its decorators and the schemas for validation from
 * it, and the React client derives request and response types from it. Changing
 * a path or the shape of a response therefore surfaces as a compile error on
 * both sides at once.
 */
export const contract = {
  auth: {
    register: defineEndpoint({
      method: 'POST',
      path: 'auth/register',
      body: registerSchema,
      response: authSessionSchema,
      auth: false,
      successStatus: 201,
      summary: 'Register a new collector',
      tag: 'auth',
    }),
    login: defineEndpoint({
      method: 'POST',
      path: 'auth/login',
      body: loginSchema,
      response: authSessionSchema,
      auth: false,
      successStatus: 200,
      summary: 'Sign in with email and password',
      tag: 'auth',
    }),
    refresh: defineEndpoint({
      method: 'POST',
      path: 'auth/refresh',
      response: authSessionSchema,
      auth: false,
      successStatus: 200,
      summary: 'Refresh the access token from the httpOnly cookie',
      tag: 'auth',
    }),
    logout: defineEndpoint({
      method: 'POST',
      path: 'auth/logout',
      response: okSchema,
      auth: false,
      successStatus: 200,
      summary: 'Sign out and invalidate the refresh token',
      tag: 'auth',
    }),
    me: defineEndpoint({
      method: 'GET',
      path: 'auth/me',
      response: userSchema,
      auth: true,
      summary: 'Profile of the signed-in user',
      tag: 'auth',
    }),
    updateProfile: defineEndpoint({
      method: 'PATCH',
      path: 'auth/me',
      body: updateProfileSchema,
      response: userSchema,
      auth: true,
      summary: 'Update the profile',
      tag: 'auth',
    }),
    changePassword: defineEndpoint({
      method: 'POST',
      path: 'auth/change-password',
      body: changePasswordSchema,
      response: okSchema,
      auth: true,
      successStatus: 200,
      summary: 'Change the password (signs out other sessions)',
      tag: 'auth',
    }),
  },

  catalog: {
    get: defineEndpoint({
      method: 'GET',
      path: 'catalog',
      response: catalogSchema,
      auth: true,
      summary: 'Platform and genre lookup tables',
      tag: 'catalog',
    }),
  },

  games: {
    /**
     * Mind the order in the controller: `games/overview` has to be declared
     * before `games/:id`, otherwise Nest would treat it as an ID.
     */
    overview: defineEndpoint({
      method: 'GET',
      path: 'games/overview',
      response: collectionOverviewSchema,
      auth: true,
      summary: 'Collection statistics and filter values with counts',
      tag: 'games',
    }),
    list: defineEndpoint({
      method: 'GET',
      path: 'games',
      query: gameListQuerySchema,
      response: gameListSchema,
      auth: true,
      summary: 'Paginated list of your own collection with filters and sorting',
      tag: 'games',
    }),
    getById: defineEndpoint({
      method: 'GET',
      path: 'games/:id',
      response: gameSchema,
      auth: true,
      summary: 'Game detail',
      tag: 'games',
    }),
    create: defineEndpoint({
      method: 'POST',
      path: 'games',
      body: createGameSchema,
      response: gameSchema,
      auth: true,
      successStatus: 201,
      summary: 'Add a game to the collection',
      tag: 'games',
    }),
    update: defineEndpoint({
      method: 'PATCH',
      path: 'games/:id',
      body: updateGameSchema,
      response: gameSchema,
      auth: true,
      summary: 'Update a game',
      tag: 'games',
    }),
    remove: defineEndpoint({
      method: 'DELETE',
      path: 'games/:id',
      response: okSchema,
      auth: true,
      successStatus: 200,
      summary: 'Remove a game from the collection',
      tag: 'games',
    }),
  },

  uploads: {
    cover: defineEndpoint({
      method: 'POST',
      path: 'uploads/cover',
      response: uploadResultSchema,
      auth: true,
      multipart: true,
      successStatus: 201,
      summary: 'Upload a cover image',
      tag: 'uploads',
    }),
  },
} as const;

/**
 * A flat list of every endpoint - used by the OpenAPI generator.
 *
 * `Object.values` over a nested `as const` object returns `any[]`, so without
 * this type annotation the whole documentation generator would work with `any`
 * and a typo in a property name would slip through.
 */
export const allEndpoints: readonly AnyEndpoint[] = Object.values(
  contract,
).flatMap((group) => Object.values(group) as AnyEndpoint[]);
