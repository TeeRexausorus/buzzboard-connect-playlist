import { useState, useEffect, useCallback, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { toast } from 'sonner';

export interface BuzzerData {
  id: string;
  name: string;
  isPressed: boolean;
  pressedAt?: Date;
  order?: number;
}

export const useMQTT = () => {
  const [client, setClient] = useState<MqttClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [buzzers, setBuzzers] = useState<Map<string, BuzzerData>>(new Map());
  const [pressOrder, setPressOrder] = useState<string[]>([]);
  const topicRef = useRef<string>('');

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
        topicRef.current = topic;
        mqttClient.subscribe(topic, (err) => {
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
          const data = JSON.parse(message.toString());
          const buzzerId = data.id || receivedTopic.split('/').pop();
          
          setBuzzers(prev => {
            const updated = new Map(prev);
            const existing = updated.get(buzzerId);
            
            if (data.pressed && !existing?.isPressed) {
              setPressOrder(order => {
                if (!order.includes(buzzerId)) {
                  return [...order, buzzerId];
                }
                return order;
              });
            }
            
            updated.set(buzzerId, {
              id: buzzerId,
              name: data.name || `Buzzer ${buzzerId}`,
              isPressed: data.pressed || false,
              pressedAt: data.pressed ? new Date() : existing?.pressedAt,
            });
            
            return updated;
          });
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
    setBuzzers(new Map());
    setPressOrder([]);
    toast.success('Buzzers reset');
  }, []);

  useEffect(() => {
    return () => {
      if (client) {
        client.end();
      }
    };
  }, [client]);

  // Update buzzer order based on press order
  useEffect(() => {
    setBuzzers(prev => {
      const updated = new Map(prev);
      updated.forEach((buzzer, id) => {
        const orderIndex = pressOrder.indexOf(id);
        if (orderIndex !== -1) {
          updated.set(id, { ...buzzer, order: orderIndex + 1 });
        }
      });
      return updated;
    });
  }, [pressOrder]);

  return {
    isConnected,
    buzzers: Array.from(buzzers.values()),
    connect,
    disconnect,
    reset,
  };
};
