import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Music, RefreshCw, LogOut } from "lucide-react";

interface SpotifyConfigPanelProps {
  clientId: string;
  setClientId: (id: string) => void;
  isAuthed: boolean;
  login: () => void;
  logout: () => void;
  devices: { id: string; name: string; type: string; is_active: boolean }[];
  selectedDeviceId: string;
  selectDevice: (id: string) => void;
  fetchDevices: () => void;
}

export const SpotifyConfigPanel = ({
  clientId,
  setClientId,
  isAuthed,
  login,
  logout,
  devices,
  selectedDeviceId,
  selectDevice,
  fetchDevices,
}: SpotifyConfigPanelProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Music className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Blind Test (Spotify)</h4>
      </div>

      {!isAuthed ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="spotifyClientId" className="text-sm text-foreground">
              Spotify Client ID
            </Label>
            <Input
              id="spotifyClientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Ton Client ID depuis developer.spotify.com"
              className="bg-input border-border text-foreground mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ajoute <code className="text-primary">{window.location.origin + "/"}</code> comme Redirect URI dans le
              dashboard Spotify.
            </p>
          </div>
          <Button onClick={login} disabled={!clientId} size="sm" className="bg-primary hover:bg-primary/90">
            Connecter Spotify
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm text-foreground">Appareil Spotify</Label>
            <Select value={selectedDeviceId} onValueChange={selectDevice}>
              <SelectTrigger className="bg-input border-border text-foreground mt-1">
                <SelectValue placeholder="Sélectionner un appareil" />
              </SelectTrigger>
              <SelectContent>
                {devices.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">Aucun appareil trouvé</div>
                ) : (
                  devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.type}){d.is_active ? " • actif" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchDevices} variant="outline" size="sm" className="bg-card border-border hover:bg-muted">
            <RefreshCw className="w-4 h-4 mr-1" /> Rafraîchir
          </Button>
          <Button onClick={logout} variant="outline" size="sm" className="bg-card border-border hover:bg-muted">
            <LogOut className="w-4 h-4 mr-1" /> Déco
          </Button>
        </div>
      )}
    </div>
  );
};
