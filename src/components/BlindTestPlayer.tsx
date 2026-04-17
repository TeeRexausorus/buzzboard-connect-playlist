import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Search, Play, Pause, Eye, EyeOff } from "lucide-react";
import type { SpotifyTrack } from "@/hooks/useSpotify";

interface BlindTestPlayerProps {
  search: (q: string) => Promise<SpotifyTrack[]>;
  playTrack: (t: SpotifyTrack) => void;
  pause: () => void;
  resume: () => void;
  currentTrack: SpotifyTrack | null;
  isAuthed: boolean;
}

export const BlindTestPlayer = ({
  search,
  playTrack,
  pause,
  resume,
  currentTrack,
  isAuthed,
}: BlindTestPlayerProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [revealed, setRevealed] = useState(false);

  if (!isAuthed) return null;

  const handleSearch = async () => {
    setSearching(true);
    const r = await search(query);
    setResults(r);
    setSearching(false);
  };

  const handlePlay = (t: SpotifyTrack) => {
    playTrack(t);
    setRevealed(false);
    setResults([]);
    setQuery("");
  };

  return (
    <Card className="p-4 bg-card/50 border-border/50 backdrop-blur-sm space-y-4">
      <div className="flex items-center gap-2">
        <Music className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-display font-bold text-foreground">Blind Test</h3>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label className="text-sm text-foreground">Rechercher un morceau</Label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Titre, artiste..."
            className="bg-input border-border text-foreground"
          />
          <Button onClick={handleSearch} disabled={searching} className="bg-primary hover:bg-primary/90">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
            {results.map((t) => (
              <button
                key={t.uri}
                onClick={() => handlePlay(t)}
                className="w-full flex items-center gap-3 p-2 rounded hover:bg-muted text-left transition-colors"
              >
                {t.album.images[2] && (
                  <img src={t.album.images[2].url} alt="" className="w-10 h-10 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.artists.map((a) => a.name).join(", ")}
                  </div>
                </div>
                <Play className="w-4 h-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current track + controls */}
      {currentTrack && (
        <div className="border-t border-border pt-4 space-y-3">
          <Label className="text-sm text-foreground">Morceau en cours</Label>
          <div className="flex items-center gap-3 p-3 rounded bg-muted/50">
            {revealed && currentTrack.album.images[1] ? (
              <img src={currentTrack.album.images[1].url} alt="" className="w-14 h-14 rounded" />
            ) : (
              <div className="w-14 h-14 rounded bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
                ?
              </div>
            )}
            <div className="flex-1 min-w-0">
              {revealed ? (
                <>
                  <div className="text-sm font-semibold text-foreground truncate">{currentTrack.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {currentTrack.artists.map((a) => a.name).join(", ")}
                  </div>
                </>
              ) : (
                <div className="text-sm font-mono text-muted-foreground">??? — ???</div>
              )}
            </div>
            <Button onClick={() => setRevealed((v) => !v)} size="sm" variant="outline" className="bg-card border-border hover:bg-muted">
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={pause} variant="outline" size="sm" className="bg-card border-border hover:bg-muted">
              <Pause className="w-4 h-4 mr-1" /> Pause
            </Button>
            <Button onClick={resume} variant="outline" size="sm" className="bg-card border-border hover:bg-muted">
              <Play className="w-4 h-4 mr-1" /> Lecture
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
