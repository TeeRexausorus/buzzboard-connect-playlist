import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { BuzzerCard } from "@/components/BuzzerCard";
import { BlindTestPlayer } from "@/components/BlindTestPlayer";
import { SpotifyConfigPanel } from "@/components/SpotifyConfigPanel";
import { QuizBuilder } from "@/components/QuizBuilder";
import { QuizPlayer } from "@/components/QuizPlayer";
import { useMQTT } from "@/hooks/useMQTT";
import { useSpotify } from "@/hooks/useSpotify";
import { useQuiz } from "@/hooks/useQuiz";
import { RotateCcw, Zap, CheckCircle, XCircle, Settings, Trophy, Lock, Palette, Send, Music, ListChecks } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const { isConnected, buzzers, pressedBuzzerId, pointValue, connect, disconnect, reset, renameBuzzer, toggleLock, handleCorrect, handleWrong, updatePointValue, resetScores, adjustScore, lockAll, publishConfig } = useMQTT();
  const spotify = useSpotify();
  const quiz = useQuiz();
  const [showConfig, setShowConfig] = useState(false);
  const [blindTestMode, setBlindTestMode] = useState(false);
  const [quizMode, setQuizMode] = useState(false);

  const enableBlindTest = (v: boolean) => {
    setBlindTestMode(v);
    if (v) setQuizMode(false);
  };
  const enableQuiz = (v: boolean) => {
    setQuizMode(v);
    if (v) setBlindTestMode(false);
  };

  // Auto-pause Spotify when a buzzer is pressed (blind test or quiz music)
  const prevPressedRef = useRef<number | null>(null);
  useEffect(() => {
    const isMusicQuestion = quizMode && quiz.currentQuestion?.type === "music";
    if (
      (blindTestMode || isMusicQuestion) &&
      pressedBuzzerId !== null &&
      prevPressedRef.current === null &&
      spotify.currentTrack
    ) {
      spotify.pause();
    }
    prevPressedRef.current = pressedBuzzerId;
  }, [pressedBuzzerId, spotify, blindTestMode, quizMode, quiz.currentQuestion]);

  const onCorrect = async () => {
    handleCorrect();
    if (quizMode) {
      if (quiz.currentQuestion?.type === "music" && spotify.currentTrack) spotify.pause();
      quiz.next();
      return;
    }
    if (!blindTestMode) return;
    if (spotify.selectedPlaylistId) {
      await spotify.playNextFromPlaylist();
    } else if (spotify.currentTrack) {
      spotify.pause();
    }
  };
  const onWrong = () => {
    handleWrong();
    if (quizMode && quiz.currentQuestion?.type === "music" && spotify.currentTrack) {
      spotify.resume();
      return;
    }
    if (blindTestMode && spotify.currentTrack) spotify.resume();
  };
  const onReset = () => {
    reset();
    if ((blindTestMode || (quizMode && quiz.currentQuestion?.type === "music")) && spotify.currentTrack) spotify.pause();
  };

  // LED config state
  const [blockedColor, setBlockedColor] = useState({ r: 255, g: 0, b: 0 });
  const [validColor, setValidColor] = useState({ r: 0, g: 255, b: 0 });
  const [idleRainbow, setIdleRainbow] = useState(true);
  const [idleColor, setIdleColor] = useState({ r: 0, g: 0, b: 255 });

  const buzzerList = Array.from(buzzers.values());

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          className={`text-center ${isConnected ? "space-y-1" : "space-y-4"}`}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: isConnected ? 0.6 : 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3">
            <Zap className={`${isConnected ? "w-4 h-4" : "w-12 h-12 animate-pulse"} text-primary`} />
            <h1 className={`${isConnected ? "text-base md:text-lg" : "text-5xl md:text-7xl text-glow"} font-display font-black text-foreground`}>
              BUZZER CONTROL
            </h1>
          </div>
          {!isConnected && (
            <p className="text-lg text-muted-foreground">
              Real-time MQTT buzzer management system
            </p>
          )}
        </motion.div>

        {/* Connection Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ConnectionPanel
            isConnected={isConnected}
            onConnect={connect}
            onDisconnect={disconnect}
            extraConfig={<SpotifyConfigPanel {...spotify} />}
          />
        </motion.div>

        {/* Control Panel */}
        {isConnected && (
          <motion.div
            className="flex justify-center gap-4 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button
              onClick={onCorrect}
              disabled={pressedBuzzerId === null}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Correct
            </Button>
            <Button
              onClick={onWrong}
              disabled={pressedBuzzerId === null}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Faux
            </Button>
            <Button
              onClick={onReset}
              variant="outline"
              className="bg-card border-border hover:bg-muted text-foreground font-semibold"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All Buzzers
            </Button>
            <Button
              onClick={lockAll}
              variant="outline"
              className="bg-card border-border hover:bg-muted text-foreground font-semibold"
            >
              <Lock className="w-4 h-4 mr-2" />
              Lock All
            </Button>
            <Button
              onClick={() => setShowConfig(!showConfig)}
              variant="outline"
              className="bg-card border-border hover:bg-muted text-foreground font-semibold"
            >
              <Settings className="w-4 h-4 mr-2" />
              Config
            </Button>
            {spotify.isAuthed && (
              <div className="flex items-center gap-2 px-3 rounded-md border border-border bg-card">
                <Music className="w-4 h-4 text-primary" />
                <Label htmlFor="blindTestMode" className="text-sm text-foreground font-semibold cursor-pointer">
                  Mode Blind Test
                </Label>
                <Switch id="blindTestMode" checked={blindTestMode} onCheckedChange={enableBlindTest} />
              </div>
            )}
            <div className="flex items-center gap-2 px-3 rounded-md border border-border bg-card">
              <ListChecks className="w-4 h-4 text-primary" />
              <Label htmlFor="quizMode" className="text-sm text-foreground font-semibold cursor-pointer">
                Mode Quiz
              </Label>
              <Switch id="quizMode" checked={quizMode} onCheckedChange={enableQuiz} />
            </div>
          </motion.div>
        )}

        {/* Config Panel */}
        {isConnected && showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 bg-card/50 border-border/50 backdrop-blur-sm space-y-6">
              {/* Points */}
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <Label htmlFor="pointValue" className="text-sm text-foreground">Valeur d'un point</Label>
                  <Input
                    id="pointValue"
                    type="number"
                    min={1}
                    value={pointValue}
                    onChange={(e) => updatePointValue(parseInt(e.target.value, 10) || 1)}
                    className="w-24 bg-input border-border text-foreground mt-1"
                  />
                </div>
                <Button
                  onClick={resetScores}
                  variant="outline"
                  className="bg-card border-border hover:bg-muted text-foreground font-semibold"
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  RAZ Scores
                </Button>
              </div>

              {/* LED Config */}
              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Configuration LEDs
                </h4>

                {/* Blocked Color */}
                <div className="flex flex-wrap items-end gap-3">
                  <Label className="text-sm text-muted-foreground w-full">Couleur bloqué (blocked_color)</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">R</Label>
                    <Input type="number" min={0} max={255} value={blockedColor.r} onChange={(e) => setBlockedColor(p => ({ ...p, r: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                    <Label className="text-xs text-muted-foreground">V</Label>
                    <Input type="number" min={0} max={255} value={blockedColor.g} onChange={(e) => setBlockedColor(p => ({ ...p, g: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                    <Label className="text-xs text-muted-foreground">B</Label>
                    <Input type="number" min={0} max={255} value={blockedColor.b} onChange={(e) => setBlockedColor(p => ({ ...p, b: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                    <div className="w-8 h-8 rounded border border-border" style={{ backgroundColor: `rgb(${blockedColor.r}, ${blockedColor.g}, ${blockedColor.b})` }} />
                    <Button size="sm" variant="outline" onClick={() => publishConfig("blocked_color", [blockedColor.r, blockedColor.g, blockedColor.b])} className="bg-card border-border hover:bg-muted text-foreground">
                      <Send className="w-3 h-3 mr-1" /> Envoyer
                    </Button>
                  </div>
                </div>

                {/* Valid Color */}
                <div className="flex flex-wrap items-end gap-3">
                  <Label className="text-sm text-muted-foreground w-full">Couleur validé (valid_color)</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">R</Label>
                    <Input type="number" min={0} max={255} value={validColor.r} onChange={(e) => setValidColor(p => ({ ...p, r: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                    <Label className="text-xs text-muted-foreground">V</Label>
                    <Input type="number" min={0} max={255} value={validColor.g} onChange={(e) => setValidColor(p => ({ ...p, g: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                    <Label className="text-xs text-muted-foreground">B</Label>
                    <Input type="number" min={0} max={255} value={validColor.b} onChange={(e) => setValidColor(p => ({ ...p, b: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                    <div className="w-8 h-8 rounded border border-border" style={{ backgroundColor: `rgb(${validColor.r}, ${validColor.g}, ${validColor.b})` }} />
                    <Button size="sm" variant="outline" onClick={() => publishConfig("valid_color", [validColor.r, validColor.g, validColor.b])} className="bg-card border-border hover:bg-muted text-foreground">
                      <Send className="w-3 h-3 mr-1" /> Envoyer
                    </Button>
                  </div>
                </div>

                {/* Idle */}
                <div className="flex flex-wrap items-end gap-3">
                  <Label className="text-sm text-muted-foreground w-full">Idle (rainbow ou couleur fixe)</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={idleRainbow} onCheckedChange={setIdleRainbow} />
                      <Label className="text-xs text-muted-foreground">Rainbow</Label>
                    </div>
                    {!idleRainbow && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">R</Label>
                        <Input type="number" min={0} max={255} value={idleColor.r} onChange={(e) => setIdleColor(p => ({ ...p, r: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                        <Label className="text-xs text-muted-foreground">V</Label>
                        <Input type="number" min={0} max={255} value={idleColor.g} onChange={(e) => setIdleColor(p => ({ ...p, g: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                        <Label className="text-xs text-muted-foreground">B</Label>
                        <Input type="number" min={0} max={255} value={idleColor.b} onChange={(e) => setIdleColor(p => ({ ...p, b: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }))} className="w-16 bg-input border-border text-foreground" />
                        <div className="w-8 h-8 rounded border border-border" style={{ backgroundColor: `rgb(${idleColor.r}, ${idleColor.g}, ${idleColor.b})` }} />
                      </div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => publishConfig("idle", idleRainbow ? true : [idleColor.r, idleColor.g, idleColor.b])} className="bg-card border-border hover:bg-muted text-foreground">
                      <Send className="w-3 h-3 mr-1" /> Envoyer
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Blind Test Player — visible quand le mode Blind Test est activé */}
        {isConnected && spotify.isAuthed && blindTestMode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <BlindTestPlayer {...spotify} />
          </motion.div>
        )}

        {/* Buzzers Grid */}
        {buzzerList.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {buzzerList.map((buzzer, index) => (
              <motion.div
                key={buzzer.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <BuzzerCard {...buzzer} onRename={renameBuzzer} onToggleLock={toggleLock} onAdjustScore={adjustScore} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          isConnected && (
            <motion.div
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <p className="text-xl text-muted-foreground">
                Waiting for buzzers to connect...
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Send messages to the subscribed topic to see them appear here
              </p>
            </motion.div>
          )
        )}

        {/* Info Panel */}
        {!isConnected && (
          <motion.div
            className="text-center py-12 space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="text-muted-foreground space-y-2">
              <h3 className="text-xl font-display font-bold text-foreground">Getting Started</h3>
              <p>1. Enter your MQTT broker details above</p>
              <p>2. Connect to start monitoring buzzers</p>
              <p>3. Buzzers will appear as they send messages</p>
              <div className="mt-6 p-4 bg-card border border-border rounded-lg max-w-2xl mx-auto text-left">
                <p className="font-semibold text-foreground mb-2">Expected message format:</p>
                <code className="text-sm text-primary">
                  {`{ "pressed": 1 }`}
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Index;
