"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

type ApiState<T> = { data?: T; error?: string; loading: boolean };

/**
 * Loads data from the API on mount and whenever `reload()` is called.
 * `loader` must be stable (a module-level function or a memoized callback).
 */
export function useApi<T>(loader: () => Promise<T>) {
  const [state, setState] = useState<ApiState<T>>({ loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loader().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false });
      },
      (error: unknown) => {
        if (!cancelled) setState((current) => ({ data: current.data, error: messageOf(error), loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loader, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}

export type ToastTone = "success" | "error";

export function useToast(duration = 3200) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback(
    (message: string, tone: ToastTone = "success") => {
      window.clearTimeout(timer.current);
      setToast({ message, tone });
      timer.current = window.setTimeout(() => setToast(null), tone === "error" ? duration * 1.8 : duration);
    },
    [duration],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { toast, show };
}
