import { useState } from "react";
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
}

export const ConnectionPanel = ({ isConnected, onConnect, onDisconnect }: ConnectionPanelProps) => {
  const [broker, setBroker] = useState("mqtts://puksrw.stackhero-network.com:13533/");
  const [topic, setTopic] = useState("buzzers/#");
  const [username, setUsername] = useState("sensor");
  const [password, setPassword] = useState("5sHLvQMhRunOs2MWkFN6B2m5JLi9OQxX");

  const handleConnect = () => {
    onConnect(broker, topic, username || undefined, password || undefined);
  };

  return (
    <Card className="p-6 bg-card border-border">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-foreground">MQTT Connection</h2>
        <Badge 
          variant={isConnected ? "default" : "secondary"}
          className={`flex items-center gap-2 ${isConnected ? 'bg-accent text-accent-foreground' : ''}`}
        >
          {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="broker" className="text-foreground">Broker URL</Label>
          <Input
            id="broker"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            placeholder="wss://broker.example.com:8081"
            disabled={isConnected}
            className="bg-input border-border text-foreground"
          />
        </div>

        <div>
          <Label htmlFor="topic" className="text-foreground">Topic</Label>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="buzzers/#"
            disabled={isConnected}
            className="bg-input border-border text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username" className="text-foreground">Username (optional)</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              disabled={isConnected}
              className="bg-input border-border text-foreground"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-foreground">Password (optional)</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              disabled={isConnected}
              className="bg-input border-border text-foreground"
            />
          </div>
        </div>

        <Button
          onClick={isConnected ? onDisconnect : handleConnect}
          className={`w-full ${isConnected ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'} text-primary-foreground font-semibold`}
        >
          {isConnected ? "Disconnect" : "Connect"}
        </Button>
      </div>
    </Card>
  );
};
