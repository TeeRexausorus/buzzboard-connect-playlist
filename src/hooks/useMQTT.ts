import { useState, useEffect, useCallback, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { toast } from 'sonner';

export interface BuzzerData {
  id: number;
  name: string;
  state: 'waiting' | 'pressed' | 'blocked';
  pressedAt?: Date;
  locked: boolean;
}

export const useMQTT = () => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [buzzers, setBuzzers] = useState<Map<number, BuzzerData>>(new Map());
  const [pressedBuzzerId, setPressedBuzzerId] = useState<number | null>(null);

  // Load buzzer names from localStorage
  const loadBuzzerNames = useCallback(() => {
    const stored = localStorage.getItem('buzzerNames');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return {};
  }, []);

  // Save buzzer names to localStorage
  const saveBuzzerNames = useCallback((names: Record<number, string>) => {
    localStorage.setItem('buzzerNames', JSON.stringify(names));
  }, []);

  const connect = useCallback((broker: string, topic: string, username?: string, password?: string) => {
    try {
      const options: mqtt.IClientOptions = {
        clean: true,
        reconnectPeriod: 1000,
      };

      if (username && password) {
        options.username = username;
        options.password = password;
      }

      const mqttClient = mqtt.connect(broker, options);
      
      mqttClient.on('connect', () => {
        setIsConnected(true);
        
        // Initialize 5 buzzers with saved names
        const savedNames = loadBuzzerNames();
        const initialBuzzers = new Map<number, BuzzerData>();
        for (let i = 1; i <= 5; i++) {
          initialBuzzers.set(i, {
            id: i,
            name: savedNames[i] || `Buzzer ${i}`,
            state: 'waiting',
            locked: false,
          });
        }
        setBuzzers(initialBuzzers);
        
        mqttClient.subscribe('buzzer/pressed', (err) => {
          if (err) {
            toast.error('Failed to subscribe to topic');
            console.error('Subscribe error:', err);
          } else {
            toast.success('Connected to MQTT broker');
          }
        });
      });

      mqttClient.on('error', (err) => {
        toast.error(`Connection error: ${err.message}`);
        console.error('MQTT Error:', err);
      });

      mqttClient.on('message', (receivedTopic, message) => {
        try {
          const raw = message.toString();
          console.log('[MQTT] Message received:', receivedTopic, 'raw:', raw);
          if (receivedTopic === 'buzzer/pressed') {
            const data = JSON.parse(raw);
            const buzzerId = data.pressed;
            console.log('[MQTT] Parsed buzzerId:', buzzerId);
            if (typeof buzzerId === 'number' && buzzerId >= 1 && buzzerId <= 5) {
              setPressedBuzzerId(buzzerId);
              toast.success(`Buzzer ${buzzerId} pressed!`);
            } else if (buzzerId === 0) {
              setPressedBuzzerId(null);
            }
          }
        } catch (err) {
          console.error('Error parsing MQTT message:', err);
        }
      });

      mqttClient.on('close', () => {
        setIsConnected(false);
        toast.info('Disconnected from MQTT broker');
      });

      setClient(mqttClient);
    } catch (err) {
      toast.error('Failed to connect to MQTT broker');
      console.error('Connection error:', err);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (client) {
      client.end();
      setClient(null);
      setIsConnected(false);
    }
  }, [client]);

  const reset = useCallback(() => {
    if (client && isConnected) {
      client.publish('buzzer/control', JSON.stringify({ release: "" }));
      client.publish('buzzer/pressed', JSON.stringify({ pressed: 0 }), { retain: true });
      // Unlock all locked buzzers
      const lockedIds: number[] = [];
      buzzers.forEach((buzzer) => {
        if (buzzer.locked) lockedIds.push(buzzer.id);
      });
      if (lockedIds.length > 0) {
        client.publish('buzzer/control', JSON.stringify({ unlock: lockedIds }));
      }
      setBuzzers(prev => {
        const updated = new Map(prev);
        updated.forEach((buzzer, id) => {
          updated.set(id, { ...buzzer, locked: false, state: 'waiting', pressedAt: undefined });
        });
        return updated;
      });
      setPressedBuzzerId(null);
      toast.success('Buzzers reset');
    }
  }, [client, isConnected, buzzers]);

  const handleCorrect = useCallback(() => {
    if (client && isConnected) {
      // Release all buzzers
      client.publish('buzzer/control', JSON.stringify({ release: "" }));
      client.publish('buzzer/pressed', JSON.stringify({ pressed: 0 }), { retain: true });
      // Unlock all locked buzzers
      const lockedIds: number[] = [];
      buzzers.forEach((buzzer) => {
        if (buzzer.locked) lockedIds.push(buzzer.id);
      });
      if (lockedIds.length > 0) {
        client.publish('buzzer/control', JSON.stringify({ unlock: lockedIds }));
      }
      // Update local state
      setBuzzers(prev => {
        const updated = new Map(prev);
        updated.forEach((buzzer, id) => {
          updated.set(id, { ...buzzer, locked: false, state: 'waiting', pressedAt: undefined });
        });
        return updated;
      });
      setPressedBuzzerId(null);
      toast.success('Bonne réponse ! Buzzers libérés');
    }
  }, [client, isConnected, buzzers]);

  const handleWrong = useCallback(() => {
    if (client && isConnected && pressedBuzzerId !== null) {
      // Lock the buzzer that had the hand
      client.publish('buzzer/control', JSON.stringify({ lock: [pressedBuzzerId] }));
      // Release all buzzers
      client.publish('buzzer/control', JSON.stringify({ release: "" }));
      client.publish('buzzer/pressed', JSON.stringify({ pressed: 0 }), { retain: true });
      // Update local state
      setBuzzers(prev => {
        const updated = new Map(prev);
        updated.forEach((buzzer, id) => {
          if (id === pressedBuzzerId) {
            updated.set(id, { ...buzzer, locked: true, state: 'waiting', pressedAt: undefined });
          } else {
            updated.set(id, { ...buzzer, state: 'waiting', pressedAt: undefined });
          }
        });
        return updated;
      });
      const lockedName = buzzers.get(pressedBuzzerId)?.name || `Buzzer ${pressedBuzzerId}`;
      setPressedBuzzerId(null);
      toast.error(`Mauvaise réponse ! ${lockedName} verrouillé`);
    }
  }, [client, isConnected, pressedBuzzerId, buzzers]);

  const renameBuzzer = useCallback((id: number, newName: string) => {
    setBuzzers(prev => {
      const updated = new Map(prev);
      const buzzer = updated.get(id);
      if (buzzer) {
        updated.set(id, { ...buzzer, name: newName });
      }
      return updated;
    });

    const names = loadBuzzerNames();
    names[id] = newName;
    saveBuzzerNames(names);
  }, [loadBuzzerNames, saveBuzzerNames]);

  const toggleLock = useCallback((id: number) => {
    setBuzzers(prev => {
      const updated = new Map(prev);
      const buzzer = updated.get(id);
      if (buzzer && client && isConnected) {
        const newLocked = !buzzer.locked;
        updated.set(id, { ...buzzer, locked: newLocked });
        const topic = 'buzzer/control';
        if (newLocked) {
          client.publish(topic, JSON.stringify({ lock: [id] }));
        } else {
          client.publish(topic, JSON.stringify({ unlock: [id] }));
        }
      }
      return updated;
    });
  }, [client, isConnected]);

  useEffect(() => {
    return () => {
      if (client) {
        client.end();
      }
    };
  }, [client]);

  // Update buzzer states based on pressed buzzer
  useEffect(() => {
    setBuzzers(prev => {
      const updated = new Map(prev);
      updated.forEach((buzzer, id) => {
        if (pressedBuzzerId === null) {
          updated.set(id, { ...buzzer, state: 'waiting', pressedAt: undefined });
        } else if (id === pressedBuzzerId) {
          updated.set(id, { ...buzzer, state: 'pressed', pressedAt: new Date() });
        } else {
          updated.set(id, { ...buzzer, state: 'blocked' });
        }
      });
      return updated;
    });
  }, [pressedBuzzerId]);

  return {
    isConnected,
    buzzers,
    pressedBuzzerId,
    connect,
    disconnect,
    reset,
    renameBuzzer,
    toggleLock,
    handleCorrect,
    handleWrong,
  };
};
