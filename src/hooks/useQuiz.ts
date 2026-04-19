import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface Quiz {
  id: string;
  name: string;
  questions: Question[];
  createdAt: number;
  updatedAt?: number;
}

const QUIZZES_KEY = "quizzes";
const ACTIVE_KEY = "activeQuizId";
const RUNTIME_KEY = "quizRuntime"; // { index, revealed }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "";

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const hex = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${hex()}-${hex().slice(0, 4)}-4${hex().slice(0, 3)}-a${hex().slice(0, 3)}-${hex()}${hex().slice(0, 4)}`;
};

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

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
};

const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

const api = {
  getQuizzes: async (): Promise<Quiz[]> => {
    const response = await fetch(apiUrl("/api/quizzes"));
    return readJson<Quiz[]>(response);
  },
  createQuiz: async (payload: { name: string; questions: Question[] }): Promise<Quiz> => {
    const response = await fetch(apiUrl("/api/quizzes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readJson<Quiz>(response);
  },
  updateQuiz: async (
    id: string,
    payload: { name?: string; questions?: Question[] },
  ): Promise<Quiz> => {
    const response = await fetch(apiUrl(`/api/quizzes/${id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readJson<Quiz>(response);
  },
  deleteQuiz: async (id: string): Promise<void> => {
    const response = await fetch(apiUrl(`/api/quizzes/${id}`), { method: "DELETE" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
  },
};

export const useQuiz = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => loadQuizzes());
  const [activeQuizId, setActiveQuizId] = useState<string>(() => localStorage.getItem(ACTIVE_KEY) || "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [usingApi, setUsingApi] = useState(true);
  const initializedRef = useRef(false);

  // Persist quizzes locally as offline cache/fallback.
  useEffect(() => {
    localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
  }, [quizzes]);

  useEffect(() => {
    if (activeQuizId) localStorage.setItem(ACTIVE_KEY, activeQuizId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeQuizId]);

  useEffect(() => {
    localStorage.setItem(
      RUNTIME_KEY,
      JSON.stringify({ index: currentIndex, revealed, ts: Date.now() }),
    );
  }, [currentIndex, revealed, activeQuizId]);

  const ensureDefaultQuiz = useCallback(() => {
    setQuizzes((prev) => {
      if (prev.length > 0) return prev;
      const fallback: Quiz = {
        id: uid(),
        name: "Quiz par défaut",
        questions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setActiveQuizId(fallback.id);
      return [fallback];
    });
  }, []);

  const syncFromApi = useCallback(async () => {
    const remoteQuizzes = await api.getQuizzes();
    setQuizzes(remoteQuizzes);

    if (remoteQuizzes.length === 0) {
      setActiveQuizId("");
      return;
    }

    setActiveQuizId((prevId) => {
      if (prevId && remoteQuizzes.some((q) => q.id === prevId)) return prevId;
      return remoteQuizzes[0].id;
    });
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const boot = async () => {
      try {
        await syncFromApi();
        setUsingApi(true);
      } catch (error) {
        console.warn("Quiz backend unavailable, fallback to localStorage", error);
        setUsingApi(false);
        ensureDefaultQuiz();
      }
    };

    void boot();
  }, [ensureDefaultQuiz, syncFromApi]);

  useEffect(() => {
    if (quizzes.length === 0) return;
    if (!activeQuizId || !quizzes.find((q) => q.id === activeQuizId)) {
      setActiveQuizId(quizzes[0].id);
    }
  }, [quizzes, activeQuizId]);

  const activeQuiz = useMemo(
    () => quizzes.find((q) => q.id === activeQuizId) || null,
    [quizzes, activeQuizId],
  );

  const currentQuestion = activeQuiz?.questions[currentIndex] || null;

  const updateActiveQuizQuestions = useCallback((updater: (questions: Question[]) => Question[]) => {
    setQuizzes((prev) =>
      prev.map((quiz) =>
        quiz.id === activeQuizId
          ? { ...quiz, questions: updater(quiz.questions), updatedAt: Date.now() }
          : quiz,
      ),
    );
  }, [activeQuizId]);

  const persistActiveQuizToApi = useCallback(async (quizId: string, nextQuestions: Question[]) => {
    if (!usingApi) return;
    try {
      const updated = await api.updateQuiz(quizId, { questions: nextQuestions });
      setQuizzes((prev) => prev.map((q) => (q.id === quizId ? updated : q)));
    } catch (error) {
      console.warn("Failed to persist questions to API, switching to local fallback", error);
      setUsingApi(false);
    }
  }, [usingApi]);

  const createQuiz = useCallback((name: string) => {
    const normalizedName = name.trim() || "Nouveau quiz";
    const optimisticQuiz: Quiz = {
      id: uid(),
      name: normalizedName,
      questions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setQuizzes((prev) => [...prev, optimisticQuiz]);
    setActiveQuizId(optimisticQuiz.id);
    setCurrentIndex(0);
    setRevealed(false);

    if (usingApi) {
      void api
        .createQuiz({ name: normalizedName, questions: [] })
        .then((created) => {
          setQuizzes((prev) => prev.map((q) => (q.id === optimisticQuiz.id ? created : q)));
          setActiveQuizId((prevId) => (prevId === optimisticQuiz.id ? created.id : prevId));
        })
        .catch((error) => {
          console.warn("Failed to create quiz on API, keeping local quiz", error);
          setUsingApi(false);
        });
    }

    return optimisticQuiz.id;
  }, [usingApi]);

  const renameQuiz = useCallback((id: string, name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;

    const previous = quizzes;
    setQuizzes((prev) => prev.map((q) => (q.id === id ? { ...q, name: normalizedName } : q)));

    if (usingApi) {
      void api.updateQuiz(id, { name: normalizedName }).catch((error) => {
        console.warn("Failed to rename quiz on API, reverting local state", error);
        setQuizzes(previous);
        setUsingApi(false);
      });
    }
  }, [quizzes, usingApi]);

  const duplicateQuiz = useCallback((id: string) => {
    const source = quizzes.find((q) => q.id === id);
    if (!source) return;

    const duplicatedQuestions = source.questions.map((q) => ({ ...q, id: uid() })) as Question[];
    const duplicatedName = `${source.name} (copie)`;
    const optimisticQuiz: Quiz = {
      id: uid(),
      name: duplicatedName,
      questions: duplicatedQuestions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setQuizzes((prev) => [...prev, optimisticQuiz]);
    setActiveQuizId(optimisticQuiz.id);
    setCurrentIndex(0);
    setRevealed(false);

    if (usingApi) {
      void api
        .createQuiz({ name: duplicatedName, questions: duplicatedQuestions })
        .then((created) => {
          setQuizzes((prev) => prev.map((q) => (q.id === optimisticQuiz.id ? created : q)));
          setActiveQuizId((prevId) => (prevId === optimisticQuiz.id ? created.id : prevId));
        })
        .catch((error) => {
          console.warn("Failed to duplicate quiz on API, keeping local copy", error);
          setUsingApi(false);
        });
    }
  }, [quizzes, usingApi]);

  const deleteQuiz = useCallback((id: string) => {
    const previous = quizzes;
    setQuizzes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      if (activeQuizId === id) {
        setActiveQuizId(next[0]?.id || "");
        setCurrentIndex(0);
        setRevealed(false);
      }
      return next;
    });

    if (usingApi) {
      void api.deleteQuiz(id).catch((error) => {
        console.warn("Failed to delete quiz on API, reverting local state", error);
        setQuizzes(previous);
        setUsingApi(false);
      });
    }
  }, [activeQuizId, quizzes, usingApi]);

  const selectQuiz = useCallback((id: string) => {
    setActiveQuizId(id);
    setCurrentIndex(0);
    setRevealed(false);
  }, []);

  const addQuestion = useCallback((q: DistributiveOmit<Question, "id">) => {
    if (!activeQuiz) return;
    const nextQuestions = [...activeQuiz.questions, { ...q, id: uid() } as Question];
    updateActiveQuizQuestions(() => nextQuestions);
    void persistActiveQuizToApi(activeQuiz.id, nextQuestions);
  }, [activeQuiz, persistActiveQuizToApi, updateActiveQuizQuestions]);

  const updateQuestion = useCallback((qid: string, patch: Partial<Question>) => {
    if (!activeQuiz) return;
    const nextQuestions = activeQuiz.questions.map((q) =>
      q.id === qid ? ({ ...q, ...patch } as Question) : q,
    );
    updateActiveQuizQuestions(() => nextQuestions);
    void persistActiveQuizToApi(activeQuiz.id, nextQuestions);
  }, [activeQuiz, persistActiveQuizToApi, updateActiveQuizQuestions]);

  const removeQuestion = useCallback((qid: string) => {
    if (!activeQuiz) return;
    const nextQuestions = activeQuiz.questions.filter((q) => q.id !== qid);
    updateActiveQuizQuestions(() => nextQuestions);
    void persistActiveQuizToApi(activeQuiz.id, nextQuestions);
  }, [activeQuiz, persistActiveQuizToApi, updateActiveQuizQuestions]);

  const moveQuestion = useCallback((qid: string, dir: -1 | 1) => {
    if (!activeQuiz) return;
    const idx = activeQuiz.questions.findIndex((q) => q.id === qid);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= activeQuiz.questions.length) return;

    const nextQuestions = [...activeQuiz.questions];
    [nextQuestions[idx], nextQuestions[newIdx]] = [nextQuestions[newIdx], nextQuestions[idx]];

    updateActiveQuizQuestions(() => nextQuestions);
    void persistActiveQuizToApi(activeQuiz.id, nextQuestions);
  }, [activeQuiz, persistActiveQuizToApi, updateActiveQuizQuestions]);

  const total = activeQuiz?.questions.length || 0;

  const next = useCallback(() => {
    setRevealed(false);
    setCurrentIndex((i) => Math.min(i + 1, Math.max(0, total - 1)));
  }, [total]);

  const prev = useCallback(() => {
    setRevealed(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const goTo = useCallback((i: number) => {
    setRevealed(false);
    setCurrentIndex(Math.max(0, Math.min(i, Math.max(0, total - 1))));
  }, [total]);

  const resetRun = useCallback(() => {
    setRevealed(false);
    setCurrentIndex(0);
  }, []);

  const toggleReveal = useCallback(() => setRevealed((r) => !r), []);

  return {
    quizzes,
    activeQuiz,
    activeQuizId,
    usingApi,
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
