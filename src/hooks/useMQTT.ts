import { useState, useEffect, useCallback, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { toast } from 'sonner';

export interface BuzzerData {
  id: number;
  name: string;
  state: 'waiting' | 'pressed' | 'blocked';
  pressedAt?: Date;
}

export const useMQTT = () => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [buzzers, setBuzzers] = useState<Map<number, BuzzerData>>(new Map());
  const [pressedBuzzerId, setPressedBuzzerId] = useState<number | null>(null);

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
        
        // Initialize 5 buzzers
        const initialBuzzers = new Map<number, BuzzerData>();
        for (let i = 1; i <= 5; i++) {
          initialBuzzers.set(i, {
            id: i,
            name: `Buzzer ${i}`,
            state: 'waiting',
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
          if (receivedTopic === 'buzzer/pressed') {
            const buzzerId = parseInt(message.toString());
            if (buzzerId >= 1 && buzzerId <= 5) {
              setPressedBuzzerId(buzzerId);
              toast.success(`Buzzer ${buzzerId} pressed!`);
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
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
      setPressedBuzzerId(null);
      toast.success('Buzzers reset');
    }
  }, [client, isConnected]);

  const releaseBuzzer = useCallback((buzzerId: number) => {
    if (client && isConnected) {
      client.publish('buzzer/control', JSON.stringify({ release: [buzzerId] }));
      setPressedBuzzerId(null);
      toast.success(`Buzzer ${buzzerId} libéré`);
    }
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
    buzzers: Array.from(buzzers.values()),
    connect,
    disconnect,
    reset,
    releaseBuzzer,
  };
};
