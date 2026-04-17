import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionPanelProps {
  isConnected: boolean;
  onConnect: (broker: string, topic: string, username?: string, password?: string) => void;
  onDisconnect: () => void;
  extraConfig?: ReactNode;
}

const computeDefaultBroker = () => {
  if (typeof window === "undefined") return "ws://localhost:9001/";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${proto}://${host}:9001/`;
};

export const ConnectionPanel = ({ isConnected, onConnect, onDisconnect, extraConfig }: ConnectionPanelProps) => {
  const [broker, setBroker] = useState(() => localStorage.getItem('buzzerBrokerUrl') || computeDefaultBroker());
  const [topic, setTopic] = useState("buzzers/#");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const handleConnect = () => {
    onConnect(broker, topic, username || undefined, password || undefined);
  };

  return (
    <Card className="p-4 bg-card/50 border-border/50 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className={`flex items-center gap-2 ${isConnected ? 'bg-accent text-accent-foreground' : ''}`}
          >
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? "Connecté" : "Déconnecté"}
          </Badge>
          {!isExpanded && (
            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
              {broker}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={isConnected ? onDisconnect : handleConnect}
            size="sm"
            variant={isConnected ? "destructive" : "default"}
          >
            {isConnected ? "Déconnecter" : "Connecter"}
          </Button>
          <Button
            onClick={() => setIsExpanded(!isExpanded)}
            size="sm"
            variant="ghost"
          >
            {isExpanded ? "Réduire" : "Configurer"}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 mt-4 pt-4 border-t border-border">
          {!isConnected && (
            <>
              <div>
                <Label htmlFor="broker" className="text-sm text-foreground">Broker URL</Label>
                <Input
                  id="broker"
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  placeholder="wss://broker.example.com:8081"
                  className="bg-input border-border text-foreground mt-1"
                />
              </div>

              <div>
                <Label htmlFor="topic" className="text-sm text-foreground">Topic</Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="buzzers/#"
                  className="bg-input border-border text-foreground mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="username" className="text-sm text-foreground">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="bg-input border-border text-foreground mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm text-foreground">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    className="bg-input border-border text-foreground mt-1"
                  />
                </div>
              </div>
            </>
          )}

          {extraConfig && (
            <div className={!isConnected ? "border-t border-border pt-4" : ""}>
              {extraConfig}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
