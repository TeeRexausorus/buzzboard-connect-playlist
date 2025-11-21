import { Button } from "@/components/ui/button";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { BuzzerCard } from "@/components/BuzzerCard";
import { useMQTT } from "@/hooks/useMQTT";
import { RotateCcw, Zap } from "lucide-react";
import { motion } from "framer-motion";

const Index = () => {
  const { isConnected, buzzers, connect, disconnect, reset, renameBuzzer } = useMQTT();

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
            className="flex justify-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button
              onClick={reset}
              variant="outline"
              className="bg-card border-border hover:bg-muted text-foreground font-semibold"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset All Buzzers
            </Button>
          </motion.div>
        )}

        {/* Buzzers Grid */}
        {buzzers.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {buzzers.map((buzzer, index) => (
              <motion.div
                key={buzzer.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <BuzzerCard {...buzzer} onRename={renameBuzzer} />
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
                  {`{ "id": "buzzer_1", "name": "Player 1", "pressed": true }`}
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
