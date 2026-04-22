import { useState } from "react";
import { Shield, LogOut } from "lucide-react";
import type { UseAuthReturn } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthPanelProps {
  auth: UseAuthReturn;
}

export const AuthPanel = ({ auth }: AuthPanelProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    try {
      const result = await auth.login(email, password);
      setInfo(result.created ? "Compte créé et connecté." : "Connexion réussie.");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    }
  };

  return (
    <Card className="p-4 bg-card/50 border-border/50 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Compte quiz</h3>
            <p className="text-xs text-muted-foreground">
              {auth.user ? `Connecté en tant que ${auth.user.email}` : "Connexion email/mot de passe"}
            </p>
          </div>
        </div>

        {auth.user && (
          <Button size="sm" variant="outline" onClick={auth.logout}>
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Déconnexion
          </Button>
        )}
      </div>

      {!auth.user && (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <Label htmlFor="quiz-email" className="text-sm text-foreground">Email</Label>
            <Input
              id="quiz-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="you@example.com"
              className="mt-1 bg-input border-border text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="quiz-password" className="text-sm text-foreground">Mot de passe</Label>
            <Input
              id="quiz-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="minimum 6 caractères"
              className="mt-1 bg-input border-border text-foreground"
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={auth.isLoading || !email.trim() || password.length < 6}
            className="bg-primary hover:bg-primary/90"
          >
            Se connecter
          </Button>
        </div>
      )}

      {info && <p className="text-xs text-primary">{info}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!auth.user && (
        <p className="text-xs text-muted-foreground">
          Si l'email n’existe pas encore, le backend crée automatiquement le compte.
        </p>
      )}
    </Card>
  );
};
