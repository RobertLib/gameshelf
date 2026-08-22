import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@gameshelf/contracts';
import { cn } from '~/lib/cn';
import { pageWindow } from './page-window';
import { formatNumber } from '~/lib/format';

/**
 * Pagination listing the numbers with ellipses, so the row stays short even for
 * a collection of thousands of items.
 */
export function Pagination({
  meta,
  onPageChange,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) return null;

  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.totalItems);

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
      aria-label="Pagination"
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {formatNumber(from)}–{formatNumber(to)} of{' '}
        {formatNumber(meta.totalItems)}
      </p>

      <div className="flex items-center gap-1">
        <PageButton
          disabled={!meta.hasPrevious}
          onClick={() => onPageChange(meta.page - 1)}
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </PageButton>

        {pageWindow(meta.page, meta.totalPages).map((entry, index) =>
          entry === 'gap' ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-slate-400"
              aria-hidden
            >
              …
            </span>
          ) : (
            <PageButton
              key={entry}
              onClick={() => onPageChange(entry)}
              current={entry === meta.page}
              label={`Page ${entry}`}
            >
              {entry}
            </PageButton>
          ),
        )}

        <PageButton
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          label="Next page"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  current,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** The current page - it is highlighted and gets `aria-current`. */
  current?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors',
        current
          ? 'bg-brand-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {children}
    </button>
  );
}
