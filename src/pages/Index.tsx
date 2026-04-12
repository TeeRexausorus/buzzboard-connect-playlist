import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { BuzzerCard } from "@/components/BuzzerCard";
import { useMQTT } from "@/hooks/useMQTT";
import { RotateCcw, Zap, CheckCircle, XCircle, Settings, Trophy } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const { isConnected, buzzers, pressedBuzzerId, pointValue, connect, disconnect, reset, renameBuzzer, toggleLock, handleCorrect, handleWrong, updatePointValue, resetScores } = useMQTT();
  const [showConfig, setShowConfig] = useState(false);

  const buzzerList = Array.from(buzzers.values());

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3">
            <Zap className="w-12 h-12 text-primary animate-pulse" />
            <h1 className="text-5xl md:text-7xl font-display font-black text-foreground text-glow">
              BUZZER CONTROL
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Real-time MQTT buzzer management system
          </p>
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
              onClick={handleCorrect}
              disabled={pressedBuzzerId === null}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Correct
            </Button>
            <Button
              onClick={handleWrong}
              disabled={pressedBuzzerId === null}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Faux
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              className="bg-card border-border hover:bg-muted text-foreground font-semibold"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All Buzzers
            </Button>
            <Button
              onClick={() => setShowConfig(!showConfig)}
              variant="outline"
              className="bg-card border-border hover:bg-muted text-foreground font-semibold"
            >
              <Settings className="w-4 h-4 mr-2" />
              Config
            </Button>
          </motion.div>
        )}

        {/* Config Panel */}
        {isConnected && showConfig && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-4 bg-card/50 border-border/50 backdrop-blur-sm">
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
            </Card>
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
                <BuzzerCard {...buzzer} onRename={renameBuzzer} onToggleLock={toggleLock} />
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
