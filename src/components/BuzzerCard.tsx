import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BuzzerCardProps {
  id: string;
  name: string;
  isPressed: boolean;
  pressedAt?: Date;
  order?: number;
}

export const BuzzerCard = ({ id, name, isPressed, pressedAt, order }: BuzzerCardProps) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: isPressed ? 1.05 : 1,
        opacity: 1 
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <Card 
        className={`p-6 relative overflow-hidden transition-all duration-300 ${
          isPressed 
            ? 'bg-gradient-to-br from-buzzer-pressed to-secondary border-secondary buzzer-glow' 
            : 'bg-card border-border hover:border-primary/50'
        }`}
      >
        {isPressed && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1 }}
          />
        )}
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-2xl font-display font-bold text-foreground">
              {name}
            </h3>
            {order && (
              <Badge variant="secondary" className="text-xl font-display">
                #{order}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mb-2">ID: {id}</p>
          
          {isPressed && pressedAt && (
            <motion.p 
              className="text-sm font-medium text-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Pressed at: {pressedAt.toLocaleTimeString()}
            </motion.p>
          )}
          
          {!isPressed && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm">Waiting...</span>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
