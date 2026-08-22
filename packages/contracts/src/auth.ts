import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * Classic email-and-password sign-in.
 *
 * The email is never rewritten by a transform in the schema - normalization
 * (trim + lowercase) happens in the service layer, so the schema stays purely
 * validational and OpenAPI can be generated from it without special cases.
 */

export const emailSchema = z
  .email({ message: 'Enter a valid email address.' })
  .max(254, { message: 'The email address is too long.' });

export const passwordSchema = z
  .string()
  .min(10, { message: 'The password must be at least 10 characters long.' })
  .max(128, { message: 'The password may be at most 128 characters long.' });

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'The name must be at least 2 characters long.' })
  .max(60, { message: 'The name may be at most 60 characters long.' });

/** Public profile of the signed-in user. */
export const userSchema = z.object({
  id: idSchema,
  email: z.string(),
  displayName: z.string(),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'Enter your password.' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * The response to registration/login/refresh.
 *
 * The access token is short-lived and the frontend keeps it in memory only. The
 * refresh token is sent exclusively in an httpOnly cookie, so it never appears
 * in the response body.
 */
export const authSessionSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
  /** Access token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  email: emailSchema.optional(),
  /**
   * Confirmation of identity - needed only when the email really changes.
   *
   * The email *is* the login name, so moving it is the first half of an account
   * takeover: an access token lives for minutes and used to be enough to point
   * somebody else's account at an address of one's own choosing, while changing
   * the password (the harder half) has always demanded the old one.
   *
   * Whether the address changes at all is decided by the service - it is the
   * only side that knows the current one. The schema therefore keeps the field
   * optional, and an empty input is the same as an absent one so that saving a
   * new display name does not ask for a password.
   */
  currentPassword: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().min(1, { message: 'Enter your current password.' }).optional(),
  ),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: 'Enter your current password.' }),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'The new password must differ from the current one.',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
