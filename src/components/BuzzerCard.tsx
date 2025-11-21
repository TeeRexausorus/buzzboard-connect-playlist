import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BuzzerCardProps {
  id: number;
  name: string;
  state: 'waiting' | 'pressed' | 'blocked';
  pressedAt?: Date;
  onRelease?: () => void;
}

export const BuzzerCard = ({ id, name, state, pressedAt, onRelease }: BuzzerCardProps) => {
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
        className={`p-6 relative overflow-hidden transition-all duration-300 ${colors[state]} ${
          state === 'pressed' || state === 'blocked' ? 'cursor-pointer hover:opacity-80' : ''
        }`}
        onClick={() => (state === 'pressed' || state === 'blocked') && onRelease?.()}
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
            <h3 className="text-3xl font-display font-bold text-foreground">
              {name}
            </h3>
            <Badge variant="secondary" className={`text-lg font-display ${textColors[state]}`}>
              {labels[state]}
            </Badge>
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
