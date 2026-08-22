import type { ReactNode } from 'react';
import { Gamepad2 } from 'lucide-react';

/** The shared frame of the sign-in and registration pages. */
export function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50 px-4 py-12 dark:from-slate-950 dark:via-slate-950 dark:to-brand-950/40">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="rounded-2xl bg-brand-600 p-3 text-white shadow-lg shadow-brand-600/25">
            <Gamepad2 className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              GameShelf
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              A catalog of a physical game collection
            </p>
          </div>
        </div>

        <div className="rounded-card border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>

          {children}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {footer}
        </p>
      </div>
    </main>
  );
}
