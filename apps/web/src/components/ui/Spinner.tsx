import { Loader2 } from 'lucide-react';
import { cn } from '~/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-brand-600', className)}
      aria-hidden
    />
  );
}

/** A placeholder for a whole page until the data arrives. */
export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400"
      role="status"
    >
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
