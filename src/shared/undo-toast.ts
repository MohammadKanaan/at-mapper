export interface UndoToastOptions {
  toastEl: HTMLElement;
  visibleClass: string;
  durationMs: number;
  onExpire?: () => void;
}

export interface UndoToast {
  show(): void;
  hide(): void;
}

export function makeUndoToast(opts: UndoToastOptions): UndoToast {
  let timer: number | null = null;

  function hide(): void {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    opts.toastEl.classList.remove(opts.visibleClass);
    opts.onExpire?.();
  }

  function show(): void {
    if (timer !== null) window.clearTimeout(timer);
    opts.toastEl.classList.add(opts.visibleClass);
    timer = window.setTimeout(hide, opts.durationMs);
  }

  return { show, hide };
}