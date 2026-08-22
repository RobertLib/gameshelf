import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema, type RegisterInput } from '@gameshelf/contracts';
import { zodFormResolver } from '~/lib/zod-resolver';
import { Alert } from '~/components/ui/Alert';
import { Button } from '~/components/ui/Button';
import { Field } from '~/components/ui/Field';
import { Input } from '~/components/ui/Input';
import { useAuth } from './auth-context';
import { useFormApiErrors } from '~/lib/use-form-api-errors';
import { AuthLayout } from './AuthLayout';

const FIELDS = ['email', 'password', 'displayName'] as const;

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput, unknown, RegisterInput>({
    resolver: zodFormResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const applyApiErrors = useFormApiErrors<RegisterInput>(setError, FIELDS);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser(values);
      await navigate('/', { replace: true });
    } catch (error) {
      setFormError(applyApiErrors(error));
    }
  });

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Set up a shelf for your collection."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Sign in
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
          label="Name"
          htmlFor="displayName"
          error={errors.displayName?.message}
          required
        >
          <Input
            id="displayName"
            autoComplete="nickname"
            autoFocus
            placeholder="What should we call you?"
            {...register('displayName')}
          />
        </Field>

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
            placeholder="you@example.com"
            {...register('email')}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 10 characters. A longer password beats a more complicated one."
          required
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>

        <Button type="submit" size="lg" loading={isSubmitting} className="mt-2">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
