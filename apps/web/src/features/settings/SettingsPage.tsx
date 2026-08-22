import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  changePasswordSchema,
  contract,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@gameshelf/contracts';
import { useMutation } from '@tanstack/react-query';
import { Alert } from '~/components/ui/Alert';
import { Button } from '~/components/ui/Button';
import { Card, CardHeader } from '~/components/ui/Card';
import { Field } from '~/components/ui/Field';
import { Input } from '~/components/ui/Input';
import { apiRequest } from '~/lib/api-client';
import { zodFormResolver } from '~/lib/zod-resolver';
import { useAuth } from '~/features/auth/auth-context';
import { useFormApiErrors } from '~/lib/use-form-api-errors';

/**
 * The field lists live at module level, not in the component body. An inline
 * literal would get a new identity on every render, so the `useCallback` inside
 * `useFormApiErrors` would never save anything - the other forms do the same.
 */
const PROFILE_FIELDS = ['displayName', 'email', 'currentPassword'] as const;
const PASSWORD_FIELDS = ['currentPassword', 'newPassword'] as const;

export function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="page-shell max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Account settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Signed in as {user?.email}
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <ProfileCard />
        <PasswordCard />
      </div>
    </div>
  );
}

function ProfileCard() {
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput, unknown, UpdateProfileInput>({
    resolver: zodFormResolver(updateProfileSchema),
    defaultValues: {
      displayName: user?.displayName ?? '',
      email: user?.email ?? '',
      currentPassword: '',
    },
  });

  /**
   * The password is asked for only when the address really changes - the same
   * rule the API applies (see `AuthService.updateProfile`). Comparing the typed
   * value normalized keeps the field from appearing over a change of letter
   * case, which the server would not treat as a change either.
   *
   * `useWatch`, not the `watch()` returned by `useForm`: that one is a function
   * the React Compiler cannot memoize, so it opts the whole component out of
   * compilation (and `eslint-plugin-react-hooks` says so out loud).
   */
  const typedEmail = useWatch({ control, name: 'email' }) ?? '';
  const emailChanged =
    typedEmail.trim().toLowerCase() !== (user?.email ?? '').toLowerCase();

  const applyApiErrors = useFormApiErrors<UpdateProfileInput>(
    setError,
    PROFILE_FIELDS,
  );

  const mutation = useMutation({
    mutationFn: (values: UpdateProfileInput) =>
      apiRequest(contract.auth.updateProfile, { body: values }),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setStatus('idle');
    try {
      const updated = await mutation.mutateAsync(values);
      updateUser(updated);
      // The password must not survive in the form after a successful save.
      reset({
        displayName: updated.displayName,
        email: updated.email,
        currentPassword: '',
      });
      setStatus('saved');
    } catch (error) {
      setFormError(applyApiErrors(error));
    }
  });

  return (
    <Card>
      <CardHeader title="Profile" description="Your name and sign-in email." />
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4 p-5"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}
        {status === 'saved' && (
          <Alert tone="success">The profile has been saved.</Alert>
        )}

        <Field
          label="Name"
          htmlFor="displayName"
          error={errors.displayName?.message}
        >
          <Input
            id="displayName"
            autoComplete="nickname"
            {...register('displayName')}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="profile-email"
          error={errors.email?.message}
        >
          <Input
            id="profile-email"
            type="email"
            autoComplete="email"
            {...register('email')}
          />
        </Field>

        {emailChanged && (
          <Field
            label="Current password"
            htmlFor="profile-current-password"
            error={errors.currentPassword?.message}
            hint="Changing the sign-in email needs your password."
            required
          >
            <Input
              id="profile-current-password"
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
            />
          </Field>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput, unknown, ChangePasswordInput>({
    resolver: zodFormResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const applyApiErrors = useFormApiErrors<ChangePasswordInput>(
    setError,
    PASSWORD_FIELDS,
  );

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordInput) =>
      apiRequest(contract.auth.changePassword, { body: values }),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setStatus('idle');
    try {
      await mutation.mutateAsync(values);
      reset({ currentPassword: '', newPassword: '' });
      setStatus('saved');
    } catch (error) {
      setFormError(applyApiErrors(error));
    }
  });

  return (
    <Card>
      <CardHeader
        title="Password"
        description="Changing it signs out every other device."
      />
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4 p-5"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}
        {status === 'saved' && (
          <Alert tone="success">
            The password has been changed and the other sessions were ended.
          </Alert>
        )}

        <Field
          label="Current password"
          htmlFor="currentPassword"
          error={errors.currentPassword?.message}
          required
        >
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            {...register('currentPassword')}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="newPassword"
          error={errors.newPassword?.message}
          hint="At least 10 characters."
          required
        >
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            {...register('newPassword')}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}
