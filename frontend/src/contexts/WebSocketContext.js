import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

const WebSocketContext = createContext(null);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      const newSocket = io(BACKEND_URL, {
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setConnected(true);
        
        // Join governorate room
        if (user.governorate) {
          newSocket.emit('join_governorate', { governorate: user.governorate });
        }
      });

      newSocket.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      });

      newSocket.on('new_transfer', (data) => {
        console.log('New transfer received:', data);
        toast.success('حوالة جديدة!', {
          description: `رمز الحوالة: ${data.transfer_code} - المبلغ: ${data.amount} IQD`,
          duration: 5000
        });
      });

      newSocket.on('transfer_completed', (data) => {
        console.log('Transfer completed:', data);
        toast.info('تم إكمال حوالة', {
          description: 'تم استلام الحوالة بنجاح'
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [isAuthenticated, user]);

  return (
    <WebSocketContext.Provider value={{ socket, connected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};