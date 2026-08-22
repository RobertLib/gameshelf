import { Button } from './Button';
import { useModalDialog } from './use-modal-dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A confirmation dialog on top of the native `<dialog>` (see `useModalDialog`).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { ref, dialogProps } = useModalDialog(open, onCancel, loading);

  return (
    <dialog
      ref={ref}
      {...dialogProps}
      className="m-auto w-full max-w-md rounded-card border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
