import { Star } from 'lucide-react';
import { cn } from '~/lib/cn';

/**
 * A 1-10 rating rendered as five stars (each = 2 points), so half a star
 * corresponds to an odd value.
 */
export function RatingStars({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  if (value === null) {
    return (
      <span className={cn('text-sm text-slate-400', className)}>Not rated</span>
    );
  }

  const filled = value / 2;

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      title={`${value} out of 10`}
      aria-label={`Rating ${value} out of 10`}
    >
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.min(Math.max(filled - index, 0), 1);
        return (
          <span key={index} className="relative inline-block h-4 w-4">
            <Star
              className="absolute inset-0 h-4 w-4 text-slate-300 dark:text-slate-600"
              aria-hidden
            />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
              aria-hidden
            >
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </span>
          </span>
        );
      })}
      <span className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">
        {value}
      </span>
    </span>
  );
}
