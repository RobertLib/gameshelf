import { useEffect, useRef, type MouseEvent, type SyntheticEvent } from 'react';

/**
 * The mechanics of a modal window on top of the native `<dialog>`.
 *
 * The browser then takes care of the focus trap, closing on Escape, returning
 * focus to the element the window was opened from and inerting the content below
 * it. A hand-built overlay would have to reimplement all of that and still would
 * not be as reliable - which is why this lives here once and both modal windows
 * in the application use it (the action confirmation and the mobile filter
 * panel). Each used to have its own implementation, and the second one could not
 * even be closed with Escape.
 *
 * @param locked An operation is in progress that there is no point interrupting -
 *   the window then closes neither on Escape nor on a click outside.
 */
export function useModalDialog(
  open: boolean,
  onClose: () => void,
  locked = false,
) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * `showModal()` does not lock the scroll behind the window on its own - the
   * wheel over `::backdrop` keeps scrolling the page underneath.
   */
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return {
    ref,
    /** Spread onto the `<dialog>`. */
    dialogProps: {
      // Escape closes the dialog natively; we have to hook our own state onto it.
      onCancel: (event: SyntheticEvent) => {
        event.preventDefault();
        if (!locked) onClose();
      },
      onClick: (event: MouseEvent<HTMLDialogElement>) => {
        // A click outside the panel lands on ::backdrop, which belongs to the
        // dialog itself.
        if (event.target === ref.current && !locked) onClose();
      },
    },
  };
}
