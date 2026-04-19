import { useCallback, useEffect, useMemo, useState } from "react";

export type QuestionType = "text" | "image" | "music";

export interface TextQuestion {
  id: string;
  type: "text";
  prompt: string;
  answer?: string;
}
export interface ImageQuestion {
  id: string;
  type: "image";
  imageUrl: string;
  prompt?: string;
  answer?: string;
}
export interface MusicQuestion {
  id: string;
  type: "music";
  trackUri: string;
  trackName: string;
  trackArtists: string;
  albumImage?: string;
  prompt?: string;
}
export type Question = TextQuestion | ImageQuestion | MusicQuestion;

type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

export interface Quiz {
  id: string;
  name: string;
  questions: Question[];
  createdAt: number;
}

const QUIZZES_KEY = "quizzes";
const ACTIVE_KEY = "activeQuizId";
const RUNTIME_KEY = "quizRuntime"; // { index, revealed } — broadcast to display page

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const loadQuizzes = (): Quiz[] => {
  try {
    const raw = localStorage.getItem(QUIZZES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const useQuiz = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => loadQuizzes());
  const [activeQuizId, setActiveQuizId] = useState<string>(
    () => localStorage.getItem(ACTIVE_KEY) || ""
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  // Persist quizzes
  useEffect(() => {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
  }, [quizzes]);

  // Persist active id
  useEffect(() => {
    if (activeQuizId) localStorage.setItem(ACTIVE_KEY, activeQuizId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeQuizId]);

  // Persist runtime (index + revealed) so the Display page can mirror it
  useEffect(() => {
    localStorage.setItem(
      RUNTIME_KEY,
      JSON.stringify({ index: currentIndex, revealed, ts: Date.now() })
    );
  }, [currentIndex, revealed, activeQuizId]);

  // Ensure at least one quiz exists; auto-select first if none active
  useEffect(() => {
    if (quizzes.length === 0) {
      const def: Quiz = { id: uid(), name: "Quiz par défaut", questions: [], createdAt: Date.now() };
      setQuizzes([def]);
      setActiveQuizId(def.id);
    } else if (!activeQuizId || !quizzes.find((q) => q.id === activeQuizId)) {
      setActiveQuizId(quizzes[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeQuiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId) || null,
    [quizzes, activeQuizId]
  );

  const currentQuestion = activeQuiz?.questions[currentIndex] || null;

  // ---- Quiz CRUD ----
  const createQuiz = useCallback((name: string) => {
    const q: Quiz = { id: uid(), name: name.trim() || "Nouveau quiz", questions: [], createdAt: Date.now() };
    setQuizzes((prev) => [...prev, q]);
    setActiveQuizId(q.id);
    setCurrentIndex(0);
    setRevealed(false);
    return q.id;
  }, []);

  const renameQuiz = useCallback((id: string, name: string) => {
    setQuizzes((prev) => prev.map((q) => (q.id === id ? { ...q, name: name.trim() || q.name } : q)));
  }, []);

  const duplicateQuiz = useCallback((id: string) => {
    setQuizzes((prev) => {
      const src = prev.find((q) => q.id === id);
      if (!src) return prev;
      const copy: Quiz = {
        id: uid(),
        name: `${src.name} (copie)`,
        questions: src.questions.map((q) => ({ ...q, id: uid() })),
        createdAt: Date.now(),
      };
      return [...prev, copy];
    });
  }, []);

  const deleteQuiz = useCallback(
    (id: string) => {
      setQuizzes((prev) => {
        const next = prev.filter((q) => q.id !== id);
        if (activeQuizId === id) {
          setActiveQuizId(next[0]?.id || "");
          setCurrentIndex(0);
          setRevealed(false);
        }
        return next;
      });
    },
    [activeQuizId]
  );

  const selectQuiz = useCallback((id: string) => {
    setActiveQuizId(id);
    setCurrentIndex(0);
    setRevealed(false);
  }, []);

  // ---- Question CRUD ----
  const addQuestion = useCallback(
    (q: DistributiveOmit<Question, "id">) => {
      if (!activeQuizId) return;
      const newQ = { ...q, id: uid() } as Question;
      setQuizzes((prev) =>
        prev.map((qz) => (qz.id === activeQuizId ? { ...qz, questions: [...qz.questions, newQ] } : qz))
      );
    },
    [activeQuizId]
  );

  const updateQuestion = useCallback(
    (qid: string, patch: Partial<Question>) => {
      if (!activeQuizId) return;
      setQuizzes((prev) =>
        prev.map((qz) =>
          qz.id === activeQuizId
            ? {
                ...qz,
                questions: qz.questions.map((q) =>
                  q.id === qid ? ({ ...q, ...patch } as Question) : q
                ),
              }
            : qz
        )
      );
    },
    [activeQuizId]
  );

  const removeQuestion = useCallback(
    (qid: string) => {
      if (!activeQuizId) return;
      setQuizzes((prev) =>
        prev.map((qz) =>
          qz.id === activeQuizId ? { ...qz, questions: qz.questions.filter((q) => q.id !== qid) } : qz
        )
      );
    },
    [activeQuizId]
  );

  const moveQuestion = useCallback(
    (qid: string, dir: -1 | 1) => {
      if (!activeQuizId) return;
      setQuizzes((prev) =>
        prev.map((qz) => {
          if (qz.id !== activeQuizId) return qz;
          const idx = qz.questions.findIndex((q) => q.id === qid);
          if (idx < 0) return qz;
          const newIdx = idx + dir;
          if (newIdx < 0 || newIdx >= qz.questions.length) return qz;
          const next = [...qz.questions];
          [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
          return { ...qz, questions: next };
        })
      );
    },
    [activeQuizId]
  );

  // ---- Navigation ----
  const total = activeQuiz?.questions.length || 0;

  const next = useCallback(() => {
    setRevealed(false);
    setCurrentIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
  }, [total]);

  const prev = useCallback(() => {
    setRevealed(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goTo = useCallback(
    (i: number) => {
      setRevealed(false);
      setCurrentIndex(Math.max(0, Math.min(i, Math.max(0, total - 1))));
    },
    [total]
  );

  const resetRun = useCallback(() => {
    setRevealed(false);
    setCurrentIndex(0);
  }, []);

  const toggleReveal = useCallback(() => setRevealed((r) => !r), []);

  return {
    quizzes,
    activeQuiz,
    activeQuizId,
    selectQuiz,
    createQuiz,
    renameQuiz,
    duplicateQuiz,
    deleteQuiz,
    addQuestion,
    updateQuestion,
    removeQuestion,
    moveQuestion,
    currentIndex,
    currentQuestion,
    total,
    revealed,
    toggleReveal,
    setRevealed,
    next,
    prev,
    goTo,
    resetRun,
  };
};

export type UseQuizReturn = ReturnType<typeof useQuiz>;
