import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@gameshelf/contracts';
import { zodFormResolver } from '~/lib/zod-resolver';
import { Alert } from '~/components/ui/Alert';
import { Button } from '~/components/ui/Button';
import { Field } from '~/components/ui/Field';
import { Input } from '~/components/ui/Input';
import { useAuth } from './auth-context';
import { useFormApiErrors } from '~/lib/use-form-api-errors';
import { AuthLayout } from './AuthLayout';

const FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginInput>({
    // The same schema as on the server - validation in the browser and in the
    // API cannot drift apart.
    resolver: zodFormResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const applyApiErrors = useFormApiErrors<LoginInput>(setError, FIELDS);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      const from = (location.state as { from?: { pathname: string } } | null)
        ?.from?.pathname;
      await navigate(from ?? '/', { replace: true });
    } catch (error) {
      setFormError(applyApiErrors(error));
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back to your collection."
      footer={
        <>
          Don&apos;t have an account yet?{' '}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field
          label="Email"
          htmlFor="email"
          error={errors.email?.message}
          required
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            {...register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          required
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
        </Field>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
