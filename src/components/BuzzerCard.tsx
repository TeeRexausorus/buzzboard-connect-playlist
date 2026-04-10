import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, Lock, Unlock, Trophy } from "lucide-react";

interface BuzzerCardProps {
  id: number;
  name: string;
  state: 'waiting' | 'pressed' | 'blocked';
  pressedAt?: Date;
  locked: boolean;
  score: number;
  onRename?: (id: number, newName: string) => void;
  onToggleLock?: (id: number) => void;
}

export const BuzzerCard = ({ id, name, state, pressedAt, locked, score, onRename, onToggleLock }: BuzzerCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(name);
  
  const handleSave = () => {
    if (editedName.trim() && onRename) {
      onRename(id, editedName.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedName(name);
    setIsEditing(false);
  };
  
  const colors = {
    waiting: 'bg-blue-500/20 border-blue-500',
    pressed: 'bg-green-500/20 border-green-500 buzzer-glow',
    blocked: 'bg-red-500/20 border-red-500',
  };

  const textColors = {
    waiting: 'text-blue-300',
    pressed: 'text-green-300',
    blocked: 'text-red-300',
  };

  const labels = {
    waiting: 'En attente',
    pressed: 'Pressé!',
    blocked: 'Bloqué',
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: state === 'pressed' ? 1.05 : 1,
        opacity: 1 
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card 
        className={`p-6 relative overflow-hidden transition-all duration-300 ${colors[state]}`}
      >
        {state === 'pressed' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1 }}
          />
        )}
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1 mr-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-xl font-bold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
                <Button size="icon" variant="ghost" onClick={handleSave} className="h-8 w-8">
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancel} className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="text-3xl font-display font-bold text-foreground">
                    {name}
                  </h3>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                    className="h-8 w-8 opacity-50 hover:opacity-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}
            {!isEditing && (
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onToggleLock?.(id)}
                  className={`h-8 w-8 ${locked ? 'text-yellow-400 opacity-100' : 'opacity-50 hover:opacity-100'}`}
                  title={locked ? 'Déverrouiller' : 'Verrouiller'}
                >
                  {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </Button>
                <Badge variant="secondary" className={`text-lg font-display ${textColors[state]}`}>
                  {locked ? 'Verrouillé' : labels[state]}
                </Badge>
              </div>
            )}
          </div>
          
          {state === 'pressed' && pressedAt && (
            <motion.p 
              className="text-sm font-medium text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Pressé à: {pressedAt.toLocaleTimeString()}
            </motion.p>
          )}
          
          {state === 'waiting' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-sm">En attente...</span>
            </div>
          )}

          {state === 'blocked' && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-sm">Un autre buzzer a été pressé</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
