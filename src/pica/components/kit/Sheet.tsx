"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { IconButton } from "./IconButton";

export interface SheetProps {
  open: boolean;
  /**
   * Called on Escape, the close button, a tap outside, or when the browser
   * closes the dialog itself. Set `open` to false here.
   */
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Actions pinned under the content, such as one Button or two stacked. */
  footer?: ReactNode;
  /**
   * The id of the <dialog>, for `aria-controls` on what opens it (such as
   * SummaryStrip's `controls`). The dialog element stays mounted while
   * closed; only its content unmounts. So the id always exists on the page.
   */
  id?: string;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where Tab should send focus to keep it inside the sheet: from the last item
 * forward to the first, from the first back to the last. Null lets the
 * browser move focus as usual.
 */
export function trapTarget<T>(items: readonly T[], active: T | null, shift: boolean): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  if (shift && active === first) return last;
  if (!shift && active === last) return first;
  return null;
}

/**
 * A bottom sheet on phones and a centred dialog from 640px up.
 * Built on the native modal <dialog>: the page behind goes inert, Escape
 * closes, focus stays inside and goes back where it came from, and the
 * page stops scrolling while it is open.
 */
export function Sheet({ open, onClose, title, description, children, footer, id, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  // True when the current press started on the backdrop.
  const pressOnBackdrop = useRef(false);
  // The effect below runs only when `open` changes; read the latest onClose.
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const root = document.documentElement;
      const before = root.style.overflow;
      root.style.overflow = "hidden";
      let locked = true;
      const unlock = () => {
        if (!locked) return;
        locked = false;
        root.style.overflow = before;
      };
      // The browser can close the dialog itself, for example on a second
      // Escape in Chrome. Free the page and tell the parent, so `open`
      // goes false and the sheet can open again.
      const handleNativeClose = () => {
        unlock();
        onCloseRef.current();
      };
      dialog.addEventListener("close", handleNativeClose);
      return () => {
        // Remove the listener first, so the close() below does not call
        // onClose a second time.
        dialog.removeEventListener("close", handleNativeClose);
        unlock();
        if (dialog.open) dialog.close();
        returnTo.current?.focus?.();
      };
    }
  }, [open]);

  function handleCancel(e: { preventDefault: () => void }) {
    // Escape: let the parent decide, so `open` stays the one source of truth.
    e.preventDefault();
    onClose();
  }

  // Presses on the backdrop land on the <dialog> itself, not its content.
  // Close only when the press both starts and ends there, so a drag that
  // starts inside the sheet (say, selecting text) and ends outside keeps it open.
  function handlePointerDown(e: PointerEvent<HTMLDialogElement>) {
    pressOnBackdrop.current = e.target === e.currentTarget;
  }

  function handleBackdrop(e: MouseEvent<HTMLDialogElement>) {
    const startedOnBackdrop = pressOnBackdrop.current;
    pressOnBackdrop.current = false;
    if (startedOnBackdrop && e.target === e.currentTarget) onClose();
  }

  function trapTab(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab") return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    const target = trapTarget(items, document.activeElement as HTMLElement | null, e.shiftKey);
    if (!target) return;
    e.preventDefault();
    target.focus();
  }

  return (
    <dialog
      ref={ref}
      id={id}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={handleCancel}
      onPointerDown={handlePointerDown}
      onClick={handleBackdrop}
      onKeyDown={trapTab}
      className={cn(
        // Phone: pinned to the bottom, full width, rounded top.
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none border-0 bg-surface p-0 text-ink",
        "rounded-t-card shadow-float backdrop:bg-ink/40",
        "transition-[translate,opacity] duration-(--duration-base) ease-out-soft starting:translate-y-full",
        // Wide: centred card.
        "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-card sm:starting:translate-y-4 sm:starting:opacity-0",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start gap-2 px-5 pb-2 pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
              <h2 id={titleId} className="text-heading font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="text-body text-ink">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton icon={X} label="Close" tone="canvas" onClick={onClose} className="-mr-1" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
          {footer ? (
            <div className="border-t border-hairline px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              {footer}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
