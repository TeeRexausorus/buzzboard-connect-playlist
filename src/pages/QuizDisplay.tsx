import { useEffect, useState } from "react";
import { Music, Image as ImageIcon, Type } from "lucide-react";
import type { Quiz, Question } from "@/hooks/useQuiz";

const QUIZZES_KEY = "quizzes";
const ACTIVE_KEY = "activeQuizId";
const RUNTIME_KEY = "quizRuntime";

interface Runtime {
  index: number;
  revealed: boolean;
}

const readQuizzes = (): Quiz[] => {
  try {
    const raw = localStorage.getItem(QUIZZES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readRuntime = (): Runtime => {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    if (!raw) return { index: 0, revealed: false };
    const parsed = JSON.parse(raw);
    return { index: parsed.index ?? 0, revealed: !!parsed.revealed };
  } catch {
    return { index: 0, revealed: false };
  }
};

const QuizDisplay = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => readQuizzes());
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(ACTIVE_KEY) || "");
  const [runtime, setRuntime] = useState<Runtime>(() => readRuntime());

  useEffect(() => {
    document.title = "Quiz — Affichage public";
  }, []);

  // Sync via storage events (cross-tab) + light polling for same-tab safety
  useEffect(() => {
    const refresh = () => {
      setQuizzes(readQuizzes());
      setActiveId(localStorage.getItem(ACTIVE_KEY) || "");
      setRuntime(readRuntime());
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || [QUIZZES_KEY, ACTIVE_KEY, RUNTIME_KEY].includes(e.key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    const id = window.setInterval(refresh, 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, []);

  const activeQuiz = quizzes.find((q) => q.id === activeId) || null;
  const total = activeQuiz?.questions.length || 0;
  const question: Question | null = activeQuiz?.questions[runtime.index] || null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="px-6 md:px-10 py-4 flex items-center justify-between border-b border-border">
        <div className="text-sm md:text-base text-muted-foreground font-mono truncate">
          {activeQuiz?.name || "Aucun quiz actif"}
        </div>
        {total > 0 && (
          <div className="text-sm md:text-base text-muted-foreground font-mono">
            {Math.min(runtime.index + 1, total)} / {total}
          </div>
        )}
      </header>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((Math.min(runtime.index, total - 1) + 1) / total) * 100}%` }}
          />
        </div>
      )}

      {/* Body */}
      <main className="flex-1 flex items-center justify-center p-6 md:p-12">
        {!activeQuiz && (
          <p className="text-2xl text-muted-foreground">En attente du lancement d'un quiz…</p>
        )}

        {activeQuiz && total === 0 && (
          <p className="text-2xl text-muted-foreground">
            Aucune question dans « {activeQuiz.name} ».
          </p>
        )}

        {question?.type === "text" && (
          <div className="text-center max-w-5xl space-y-10">
            <Type className="w-10 h-10 mx-auto text-primary/70" />
            <p className="text-4xl md:text-6xl font-display font-semibold leading-tight">
              {question.prompt}
            </p>
            {runtime.revealed && question.answer && (
              <p className="text-3xl md:text-5xl text-primary font-bold pt-6">
                → {question.answer}
              </p>
            )}
          </div>
        )}

        {question?.type === "image" && (
          <div className="w-full max-w-6xl space-y-8 text-center">
            {question.prompt && (
              <p className="text-2xl md:text-4xl font-display">{question.prompt}</p>
            )}
            <div className="flex justify-center">
              <img
                src={question.imageUrl}
                alt="question"
                className="max-h-[70vh] max-w-full object-contain rounded-lg border border-border shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            {runtime.revealed && question.answer && (
              <p className="text-3xl md:text-5xl text-primary font-bold">
                → {question.answer}
              </p>
            )}
          </div>
        )}

        {question?.type === "music" && (
          <div className="w-full max-w-3xl text-center space-y-10">
            <Music className="w-12 h-12 mx-auto text-primary/70" />
            {question.prompt && (
              <p className="text-2xl md:text-4xl font-display">{question.prompt}</p>
            )}
            <div className="flex items-center justify-center gap-6 p-6 rounded-xl bg-muted/40 border border-border">
              {runtime.revealed && question.albumImage ? (
                <img
                  src={question.albumImage}
                  alt=""
                  className="w-32 h-32 md:w-40 md:h-40 rounded-lg shadow-lg"
                />
              ) : (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-lg bg-muted flex items-center justify-center text-6xl font-bold text-muted-foreground">
                  ?
                </div>
              )}
              <div className="text-left flex-1 min-w-0">
                {runtime.revealed ? (
                  <>
                    <div className="text-2xl md:text-3xl font-bold truncate">
                      {question.trackName}
                    </div>
                    <div className="text-lg md:text-xl text-muted-foreground truncate">
                      {question.trackArtists}
                    </div>
                  </>
                ) : (
                  <div className="text-2xl md:text-3xl font-mono text-muted-foreground">
                    ??? — ???
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer hint */}
      <footer className="px-6 py-3 text-center text-xs text-muted-foreground border-t border-border">
        Affichage public — synchronisé automatiquement avec la régie
        {question && (
          <span className="ml-2 inline-flex items-center gap-1">
            ·{" "}
            {question.type === "text" && <><Type className="w-3 h-3" /> Texte</>}
            {question.type === "image" && <><ImageIcon className="w-3 h-3" /> Image</>}
            {question.type === "music" && <><Music className="w-3 h-3" /> Musique</>}
          </span>
        )}
      </footer>
    </div>
  );
};

export default QuizDisplay;
