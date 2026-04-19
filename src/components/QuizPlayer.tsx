import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Play, Pause, RotateCcw, Type, Image as ImageIcon, Music, ExternalLink } from "lucide-react";
import type { UseQuizReturn } from "@/hooks/useQuiz";
import type { SpotifyTrack } from "@/hooks/useSpotify";

interface QuizPlayerProps {
  quiz: UseQuizReturn;
  spotifyAuthed: boolean;
  playTrack: (t: SpotifyTrack) => Promise<boolean> | void;
  pause: () => void;
  resume: () => void;
}

export const QuizPlayer = ({ quiz, spotifyAuthed, playTrack, pause, resume }: QuizPlayerProps) => {
  const { currentQuestion, currentIndex, total, revealed, toggleReveal, next, prev, resetRun } = quiz;

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key.toLowerCase() === "r") toggleReveal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggleReveal]);

  const handlePlayMusic = () => {
    if (!currentQuestion || currentQuestion.type !== "music") return;
    playTrack({
      uri: currentQuestion.trackUri,
      name: currentQuestion.trackName,
      artists: currentQuestion.trackArtists.split(",").map((n) => ({ name: n.trim() })),
      album: { name: "", images: currentQuestion.albumImage ? [{ url: currentQuestion.albumImage, width: 300, height: 300 }] : [] },
    });
  };

  if (total === 0) {
    return (
      <Card className="p-8 bg-card/50 border-border/50 backdrop-blur-sm text-center">
        <p className="text-muted-foreground">Ajoute des questions dans le builder pour démarrer le quiz.</p>
      </Card>
    );
  }

  if (!currentQuestion) return null;

  const progress = ((currentIndex + 1) / total) * 100;

  return (
    <Card className="p-6 bg-card/50 border-border/50 backdrop-blur-sm space-y-4">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {currentIndex + 1} / {total}</span>
          <span className="flex items-center gap-1">
            {currentQuestion.type === "text" && <><Type className="w-3 h-3" /> Texte</>}
            {currentQuestion.type === "image" && <><ImageIcon className="w-3 h-3" /> Image</>}
            {currentQuestion.type === "music" && <><Music className="w-3 h-3" /> Musique</>}
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Question content */}
      <div className="min-h-[240px] flex items-center justify-center py-4">
        {currentQuestion.type === "text" && (
          <div className="text-center space-y-4 max-w-3xl">
            <p className="text-2xl md:text-3xl font-display font-semibold text-foreground leading-snug">
              {currentQuestion.prompt}
            </p>
            {revealed && currentQuestion.answer && (
              <p className="text-xl text-primary font-bold">→ {currentQuestion.answer}</p>
            )}
          </div>
        )}

        {currentQuestion.type === "image" && (
          <div className="space-y-4 w-full">
            {currentQuestion.prompt && (
              <p className="text-center text-lg text-foreground">{currentQuestion.prompt}</p>
            )}
            <div className="flex justify-center">
              <img
                src={currentQuestion.imageUrl}
                alt="question"
                className="max-h-[400px] max-w-full object-contain rounded border border-border"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            {revealed && currentQuestion.answer && (
              <p className="text-center text-xl text-primary font-bold">→ {currentQuestion.answer}</p>
            )}
          </div>
        )}

        {currentQuestion.type === "music" && (
          <div className="text-center space-y-4 w-full max-w-xl">
            {currentQuestion.prompt && (
              <p className="text-lg text-foreground">{currentQuestion.prompt}</p>
            )}
            <div className="flex items-center justify-center gap-4 p-4 rounded bg-muted/40">
              {revealed && currentQuestion.albumImage ? (
                <img src={currentQuestion.albumImage} alt="" className="w-20 h-20 rounded" />
              ) : (
                <div className="w-20 h-20 rounded bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground">
                  ?
                </div>
              )}
              <div className="text-left flex-1 min-w-0">
                {revealed ? (
                  <>
                    <div className="text-base font-semibold text-foreground truncate">{currentQuestion.trackName}</div>
                    <div className="text-sm text-muted-foreground truncate">{currentQuestion.trackArtists}</div>
                  </>
                ) : (
                  <div className="text-base font-mono text-muted-foreground">??? — ???</div>
                )}
              </div>
            </div>
            {spotifyAuthed && (
              <div className="flex justify-center gap-2">
                <Button onClick={handlePlayMusic} size="sm" className="bg-primary hover:bg-primary/90">
                  <Play className="w-4 h-4 mr-1" /> Lancer
                </Button>
                <Button onClick={pause} size="sm" variant="outline" className="bg-card border-border hover:bg-muted">
                  <Pause className="w-4 h-4 mr-1" /> Pause
                </Button>
                <Button onClick={resume} size="sm" variant="outline" className="bg-card border-border hover:bg-muted">
                  <Play className="w-4 h-4 mr-1" /> Reprendre
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4">
        <Button onClick={prev} variant="outline" disabled={currentIndex === 0} className="bg-card border-border hover:bg-muted">
          <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
        </Button>
        <Button onClick={toggleReveal} variant="outline" className="bg-card border-border hover:bg-muted">
          {revealed ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
          {revealed ? "Cacher" : "Révéler"}
        </Button>
        <Button onClick={next} disabled={currentIndex >= total - 1} className="bg-primary hover:bg-primary/90">
          Suivant <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
        <Button onClick={resetRun} variant="outline" size="sm" className="bg-card border-border hover:bg-muted ml-2">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Recommencer
        </Button>
      </div>
    </Card>
  );
};
