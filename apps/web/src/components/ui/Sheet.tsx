import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { useModalDialog } from './use-modal-dialog';

/**
 * A panel sliding in from the right edge - on narrow screens a replacement for
 * the sidebar column.
 *
 * It stands on the native `<dialog>` (see `useModalDialog`), so it closes on
 * Escape, traps focus and returns it to the button it was opened from. It used
 * to be a hand-rolled `<div role="dialog">` that could do none of that.
 */
export function Sheet({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { ref, dialogProps } = useModalDialog(open, onClose);

  return (
    <dialog
      ref={ref}
      {...dialogProps}
      aria-label={title}
      // `max-h-none` and `max-w-none` cancel the default <dialog> dimensions,
      // otherwise the panel would not reach the edges.
      className="ml-auto mr-0 my-0 h-dvh max-h-none w-full max-w-sm rounded-none border-0 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={`Close - ${title.toLowerCase()}`}
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {children}
        </div>

        {footer && (
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
