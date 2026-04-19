import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ListChecks,
  Plus,
  Trash2,
  Copy,
  Pencil,
  ArrowUp,
  ArrowDown,
  Type,
  Image as ImageIcon,
  Music,
  Search,
  Check,
  X,
} from "lucide-react";
import type { UseQuizReturn, Question } from "@/hooks/useQuiz";
import type { SpotifyTrack } from "@/hooks/useSpotify";

interface QuizBuilderProps {
  quiz: UseQuizReturn;
  spotifyAuthed: boolean;
  spotifySearch: (q: string) => Promise<SpotifyTrack[]>;
}

export const QuizBuilder = ({ quiz, spotifyAuthed, spotifySearch }: QuizBuilderProps) => {
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");

  // Add question form state
  const [tab, setTab] = useState<"text" | "image" | "music">("text");
  const [textPrompt, setTextPrompt] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageAnswer, setImageAnswer] = useState("");
  const [imgError, setImgError] = useState(false);
  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<SpotifyTrack[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [musicPrompt, setMusicPrompt] = useState("");

  // Edit question state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Question | null>(null);
  const [editImgError, setEditImgError] = useState(false);

  const { activeQuiz } = quiz;

  const handleCreate = () => {
    quiz.createQuiz(newName);
    setNewName("");
  };
  const handleRename = () => {
    if (activeQuiz) quiz.renameQuiz(activeQuiz.id, renameVal);
    setRenaming(false);
  };
  const handleDelete = () => {
    if (activeQuiz && confirm(`Supprimer "${activeQuiz.name}" ?`)) quiz.deleteQuiz(activeQuiz.id);
  };
  const handleDuplicate = () => {
    if (activeQuiz) quiz.duplicateQuiz(activeQuiz.id);
  };

  const handleAddText = () => {
    if (!textPrompt.trim()) return;
    quiz.addQuestion({ type: "text", prompt: textPrompt.trim(), answer: textAnswer.trim() || undefined });
    setTextPrompt("");
    setTextAnswer("");
  };
  const handleAddImage = () => {
    if (!imageUrl.trim()) return;
    quiz.addQuestion({
      type: "image",
      imageUrl: imageUrl.trim(),
      prompt: imagePrompt.trim() || undefined,
      answer: imageAnswer.trim() || undefined,
    });
    setImageUrl("");
    setImagePrompt("");
    setImageAnswer("");
    setImgError(false);
  };
  const handleSearchMusic = async () => {
    if (!musicQuery.trim()) return;
    setMusicSearching(true);
    const r = await spotifySearch(musicQuery);
    setMusicResults(r);
    setMusicSearching(false);
  };
  const handleAddMusic = (t: SpotifyTrack) => {
    quiz.addQuestion({
      type: "music",
      trackUri: t.uri,
      trackName: t.name,
      trackArtists: t.artists.map((a) => a.name).join(", "),
      albumImage: t.album.images[1]?.url || t.album.images[0]?.url,
      prompt: musicPrompt.trim() || undefined,
    });
    setMusicQuery("");
    setMusicResults([]);
    setMusicPrompt("");
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditDraft({ ...q });
    setEditImgError(false);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setEditImgError(false);
  };
  const saveEdit = () => {
    if (!editDraft || !editingId) return;
    // Build a clean patch based on type
    const { id, type, ...rest } = editDraft as Question & { id: string };
    quiz.updateQuestion(editingId, rest as Partial<Question>);
    cancelEdit();
  };

  const renderEditForm = (q: Question) => {
    if (!editDraft) return null;

    if (editDraft.type === "text") {
      return (
        <div className="space-y-2 w-full">
          <Textarea
            value={editDraft.prompt}
            onChange={(e) => setEditDraft({ ...editDraft, prompt: e.target.value })}
            className="bg-input border-border text-foreground"
            placeholder="Question"
          />
          <Input
            value={editDraft.answer || ""}
            onChange={(e) => setEditDraft({ ...editDraft, answer: e.target.value })}
            className="bg-input border-border text-foreground"
            placeholder="Réponse (optionnel)"
          />
        </div>
      );
    }
    if (editDraft.type === "image") {
      return (
        <div className="space-y-2 w-full">
          <Input
            value={editDraft.imageUrl}
            onChange={(e) => { setEditDraft({ ...editDraft, imageUrl: e.target.value }); setEditImgError(false); }}
            className="bg-input border-border text-foreground"
            placeholder="URL de l'image"
          />
          {editDraft.imageUrl && (
            <div className="rounded border border-border bg-muted/40 p-2 flex justify-center">
              {editImgError ? (
                <p className="text-xs text-destructive">Image impossible à charger</p>
              ) : (
                <img
                  src={editDraft.imageUrl}
                  alt="preview"
                  onError={() => setEditImgError(true)}
                  className="max-h-32 object-contain"
                />
              )}
            </div>
          )}
          <Input
            value={editDraft.prompt || ""}
            onChange={(e) => setEditDraft({ ...editDraft, prompt: e.target.value })}
            className="bg-input border-border text-foreground"
            placeholder="Indication / question (optionnel)"
          />
          <Input
            value={editDraft.answer || ""}
            onChange={(e) => setEditDraft({ ...editDraft, answer: e.target.value })}
            className="bg-input border-border text-foreground"
            placeholder="Réponse (optionnel)"
          />
        </div>
      );
    }
    // music: only prompt is editable (track is fixed)
    return (
      <div className="space-y-2 w-full">
        <div className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border">
          {editDraft.albumImage && <img src={editDraft.albumImage} alt="" className="w-10 h-10 rounded" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{editDraft.trackName}</div>
            <div className="text-xs text-muted-foreground truncate">{editDraft.trackArtists}</div>
          </div>
        </div>
        <Input
          value={editDraft.prompt || ""}
          onChange={(e) => setEditDraft({ ...editDraft, prompt: e.target.value })}
          className="bg-input border-border text-foreground"
          placeholder="Indication / consigne (optionnel)"
        />
        <p className="text-xs text-muted-foreground italic">
          Pour changer le morceau, supprime cette question et ajoute-en une nouvelle.
        </p>
      </div>
    );
  };

  const renderQuestionRow = (q: Question, idx: number) => {
    const icon =
      q.type === "text" ? <Type className="w-4 h-4" /> :
      q.type === "image" ? <ImageIcon className="w-4 h-4" /> :
      <Music className="w-4 h-4" />;
    const label =
      q.type === "text" ? q.prompt :
      q.type === "image" ? (q.prompt || q.imageUrl) :
      `${q.trackName} — ${q.trackArtists}`;

    const isEditing = editingId === q.id;

    if (isEditing) {
      return (
        <div key={q.id} className="flex items-start gap-2 p-2 rounded bg-muted/60 border border-primary/40">
          <span className="text-xs text-muted-foreground w-6 tabular-nums pt-2">{idx + 1}.</span>
          <span className="text-primary pt-2">{icon}</span>
          <div className="flex-1 min-w-0">{renderEditForm(q)}</div>
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={saveEdit} title="Enregistrer">
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} title="Annuler">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={q.id} className="flex items-center gap-2 p-2 rounded bg-muted/40 border border-border">
        <span className="text-xs text-muted-foreground w-6 tabular-nums">{idx + 1}.</span>
        <span className="text-primary">{icon}</span>
        <span className="flex-1 text-sm text-foreground truncate">{label}</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(q)} title="Modifier">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => quiz.moveQuestion(q.id, -1)} disabled={idx === 0}>
          <ArrowUp className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => quiz.moveQuestion(q.id, 1)} disabled={idx === (activeQuiz?.questions.length || 0) - 1}>
          <ArrowDown className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => quiz.removeQuestion(q.id)}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  };

  return (
    <Card className="p-4 bg-card/50 border-border/50 backdrop-blur-sm space-y-4">
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-display font-bold text-foreground">Quiz Builder</h3>
      </div>

      {/* Quiz selector + actions */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm text-foreground">Quiz actif</Label>
          {renaming && activeQuiz ? (
            <div className="flex gap-2 mt-1">
              <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="bg-input border-border text-foreground" />
              <Button size="sm" onClick={handleRename}>OK</Button>
              <Button size="sm" variant="outline" onClick={() => setRenaming(false)}>X</Button>
            </div>
          ) : (
            <Select value={quiz.activeQuizId || ""} onValueChange={quiz.selectQuiz}>
              <SelectTrigger className="bg-input border-border text-foreground mt-1">
                <SelectValue placeholder="Sélectionner un quiz" />
              </SelectTrigger>
              <SelectContent>
                {quiz.quizzes.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name} ({q.questions.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button size="sm" variant="outline" disabled={!activeQuiz} onClick={() => { setRenameVal(activeQuiz?.name || ""); setRenaming(true); }}>
          <Pencil className="w-3.5 h-3.5 mr-1" /> Renommer
        </Button>
        <Button size="sm" variant="outline" disabled={!activeQuiz} onClick={handleDuplicate}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Dupliquer
        </Button>
        <Button size="sm" variant="outline" disabled={!activeQuiz} onClick={handleDelete} className="text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Nom d'un nouveau quiz"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="bg-input border-border text-foreground"
        />
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Nouveau
        </Button>
      </div>

      {/* Questions list */}
      {activeQuiz && (
        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-sm text-foreground">Questions ({activeQuiz.questions.length})</Label>
          {activeQuiz.questions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune question. Ajoute-en une ci-dessous.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {activeQuiz.questions.map(renderQuestionRow)}
            </div>
          )}
        </div>
      )}

      {/* Add question */}
      {activeQuiz && (
        <div className="border-t border-border pt-4 space-y-3">
          <Label className="text-sm text-foreground">Ajouter une question</Label>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="text"><Type className="w-3.5 h-3.5 mr-1" /> Texte</TabsTrigger>
              <TabsTrigger value="image"><ImageIcon className="w-3.5 h-3.5 mr-1" /> Image</TabsTrigger>
              <TabsTrigger value="music" disabled={!spotifyAuthed}><Music className="w-3.5 h-3.5 mr-1" /> Musique</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-2 mt-3">
              <Textarea
                placeholder="Question à lire (ex: Quelle est la capitale de l'Australie ?)"
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                className="bg-input border-border text-foreground"
              />
              <Input
                placeholder="Réponse (optionnel)"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                className="bg-input border-border text-foreground"
              />
              <Button onClick={handleAddText} disabled={!textPrompt.trim()} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </TabsContent>

            <TabsContent value="image" className="space-y-2 mt-3">
              <Input
                placeholder="URL de l'image (https://...)"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImgError(false); }}
                className="bg-input border-border text-foreground"
              />
              {imageUrl && (
                <div className="rounded border border-border bg-muted/40 p-2 flex justify-center">
                  {imgError ? (
                    <p className="text-xs text-destructive">Image impossible à charger</p>
                  ) : (
                    <img
                      src={imageUrl}
                      alt="preview"
                      onError={() => setImgError(true)}
                      className="max-h-40 object-contain"
                    />
                  )}
                </div>
              )}
              <Input
                placeholder="Indication / question (optionnel)"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className="bg-input border-border text-foreground"
              />
              <Input
                placeholder="Réponse (optionnel)"
                value={imageAnswer}
                onChange={(e) => setImageAnswer(e.target.value)}
                className="bg-input border-border text-foreground"
              />
              <Button onClick={handleAddImage} disabled={!imageUrl.trim() || imgError} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-1" /> Ajouter
              </Button>
            </TabsContent>

            <TabsContent value="music" className="space-y-2 mt-3">
              {!spotifyAuthed ? (
                <p className="text-xs text-muted-foreground italic">Connecte-toi à Spotify pour ajouter des questions musicales.</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Titre, artiste..."
                      value={musicQuery}
                      onChange={(e) => setMusicQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearchMusic()}
                      className="bg-input border-border text-foreground"
                    />
                    <Button onClick={handleSearchMusic} disabled={musicSearching} className="bg-primary hover:bg-primary/90">
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Indication / consigne (optionnel)"
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    className="bg-input border-border text-foreground"
                  />
                  {musicResults.length > 0 && (
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {musicResults.map((t) => (
                        <button
                          key={t.uri}
                          onClick={() => handleAddMusic(t)}
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
                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  );
};
