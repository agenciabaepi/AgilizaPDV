import { useCallback, useState } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  /** Último estado registrado no histórico; `present` pode estar à frente dele durante um gesto. */
  committed: T;
  future: T[];
}

const LIMIT = 100;

export function useHistory<T>(initial: T) {
  const [state, setState] = useState<HistoryState<T>>({ past: [], present: initial, committed: initial, future: [] });

  /** `commit = false` atualiza sem criar entrada no histórico (arrastar, sliders); feche com `checkpoint()`. */
  const set = useCallback((updater: T | ((prev: T) => T), commit = true) => {
    setState((s) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(s.present) : updater;
      if (next === s.present) return s;
      if (!commit) return { ...s, present: next };
      return { past: [...s.past, s.committed].slice(-LIMIT), present: next, committed: next, future: [] };
    });
  }, []);

  const checkpoint = useCallback(() => {
    setState((s) =>
      s.present === s.committed
        ? s
        : { past: [...s.past, s.committed].slice(-LIMIT), present: s.present, committed: s.present, future: [] },
    );
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.present !== s.committed) return { ...s, present: s.committed };
      const prev = s.past[s.past.length - 1];
      if (prev === undefined) return s;
      return { past: s.past.slice(0, -1), present: prev, committed: prev, future: [s.present, ...s.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      const [next, ...rest] = s.future;
      if (next === undefined) return s;
      return { past: [...s.past, s.committed], present: next, committed: next, future: rest };
    });
  }, []);

  const reset = useCallback((value: T) => {
    setState({ past: [], present: value, committed: value, future: [] });
  }, []);

  return {
    state: state.present,
    set,
    checkpoint,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0 || state.present !== state.committed,
    canRedo: state.future.length > 0,
  };
}
