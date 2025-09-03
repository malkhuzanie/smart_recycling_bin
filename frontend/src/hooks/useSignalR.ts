import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

interface SignalRMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface UseSignalRReturn {
  isConnected: boolean;
  connectionState: signalR.HubConnectionState;
  lastMessage: SignalRMessage | null;
  error: string | null;
  sendMessage: (method: string, ...args: any[]) => Promise<boolean>;
  joinGroup: (groupName: string) => Promise<boolean>;
  leaveGroup: (groupName: string) => Promise<boolean>;
  reconnect: () => Promise<boolean>;
}

export type { UseSignalRReturn };

interface UseSignalROptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoJoinGroup?: string; // The group to auto-join (e.g., "Classification", "Dashboard")
  onConnected?: () => void;
  onDisconnected?: (error?: Error) => void;
  onReconnecting?: () => void;
  onReconnected?: () => void;
  onError?: (error: Error) => void;
}

type HubType = 'classification' | 'dashboard' | 'systemhealth';

const useSignalR = (
  hubUrl: string,
  options: UseSignalROptions = {}
): UseSignalRReturn => {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 5000,
    autoJoinGroup,
    onConnected,
    onDisconnected,
    onReconnecting,
    onReconnected,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<signalR.HubConnectionState>(
    signalR.HubConnectionState.Disconnected
  );
  const [lastMessage, setLastMessage] = useState<SignalRMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const hasJoinedGroupRef = useRef(false);

  // Determine the hub type from URL
  const getHubType = useCallback((url: string): HubType => {
    if (url.includes('/classification')) return 'classification';
    if (url.includes('/dashboard')) return 'dashboard';
    if (url.includes('/systemhealth')) return 'systemhealth';
    return 'classification';
  }, []);


  // Create SignalR connection
  const createConnection = useCallback(() => {
    if (connectionRef.current && 
        connectionRef.current.state !== signalR.HubConnectionState.Disconnected) {
      return connectionRef.current;
    }

    // Clean up any existing connection
    if (connectionRef.current) {
      connectionRef.current.stop().catch(() => {});
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        // Try LongPolling first to bypass WebSocket issues
        transport: signalR.HttpTransportType.LongPolling,
        skipNegotiation: false,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        }
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount >= reconnectAttempts) {
            return null;
          }
          return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
        }
      })
      .configureLogging(signalR.LogLevel.Debug) // More verbose logging for debugging
      .build();

    // Connection state change handlers
    connection.onclose((error) => {
      console.log('SignalR connection closed:', error?.message);
      setIsConnected(false);
      setConnectionState(signalR.HubConnectionState.Disconnected);
      setError(error?.message || 'Connection closed');
      hasJoinedGroupRef.current = false;
      onDisconnected?.(error);
    });

    connection.onreconnecting((error) => {
      console.log('SignalR reconnecting:', error?.message);
      setIsConnected(false);
      setConnectionState(signalR.HubConnectionState.Reconnecting);
      setError('Reconnecting...');
      hasJoinedGroupRef.current = false;
      onReconnecting?.();
    });

    connection.onreconnected(async (connectionId) => {
      console.log('SignalR reconnected with ID:', connectionId);
      setIsConnected(true);
      setConnectionState(signalR.HubConnectionState.Connected);
      setError(null);
      reconnectAttemptsRef.current = 0;
      hasJoinedGroupRef.current = false;
      
      // Auto-rejoin group after reconnection
      if (autoJoinGroup) {
        setTimeout(() => {
          joinGroupInternal(autoJoinGroup);
        }, 1000);
      }
      
      onReconnected?.();
    });

    // Register message handlers
    connection.on('ConnectionEstablished', (data) => {
      console.log('SignalR connection established:', data);
      setLastMessage({
        type: 'connection_established',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Classification hub specific handlers
    connection.on('ClassificationResult', (data) => {
      console.log('Received classification result:', data);
      setLastMessage({
        type: 'classification_result',
        data,
        timestamp: new Date().toISOString()
      });
    });

    connection.on('ProcessingStatus', (data) => {
      console.log('Received processing status:', data);
      setLastMessage({
        type: 'processing_status',
        data,
        timestamp: new Date().toISOString()
      });
    });

    connection.on('ClassificationOverridden', (data) => {
      console.log('Classification overridden:', data);
      setLastMessage({
        type: 'classification_overridden',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Dashboard hub specific handlers
    connection.on('DashboardUpdate', (data) => {
      console.log('Received dashboard update:', data);
      setLastMessage({
        type: 'dashboard_update',
        data,
        timestamp: new Date().toISOString()
      });
    });

    connection.on('SystemStatus', (data) => {
      console.log('Received system status:', data);
      setLastMessage({
        type: 'system_status',
        data,
        timestamp: new Date().toISOString()
      });
    });

    // Group join confirmations
    connection.on('JoinedClassificationGroup', (data) => {
      console.log('Joined classification group:', data);
      hasJoinedGroupRef.current = true;
    });

    connection.on('JoinedDashboardGroup', (data) => {
      console.log('Joined dashboard group:', data);
      hasJoinedGroupRef.current = true;
    });


    // ====================================================================
    // handlers for SystemHealthHub methods
    // ====================================================================
    connection.on('InitialHealthStatus', (data) => {
      console.log('Received Initial Health Status:', data);
      setLastMessage({
        type: 'InitialHealthStatus', 
        data,
        timestamp: new Date().toISOString()
      });
    });

    connection.on('HealthUpdate', (data) => {
      console.log('Received Health Update:', data);
      setLastMessage({
        type: 'HealthUpdate', 
        data,
        timestamp: new Date().toISOString()
      });
    });
    // ====================================================================


    // Error handler
    connection.on('Error', (message) => {
      console.error('SignalR error:', message);
      setError(message);
      setLastMessage({
        type: 'error',
        data: { message },
        timestamp: new Date().toISOString()
      });
      onError?.(new Error(message));
    });

    connectionRef.current = connection;
    return connection;
  }, [hubUrl, reconnectAttempts, autoJoinGroup, onConnected, onDisconnected, onReconnecting, onReconnected, onError]);

  // Internal join group method
  const joinGroupInternal = useCallback(async (groupName: string): Promise<boolean> => {
    const connection = connectionRef.current;
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      console.warn('Cannot join group: SignalR not connected');
      return false;
    }

    if (hasJoinedGroupRef.current) {
      console.log('Already joined group');
      return true;
    }

    try {
      const hubType = getHubType(hubUrl);
      let methodName: string;

      // Use correct method based on hub type and group
      
      if (hubType === 'classification') {
        methodName = groupName === 'Dashboard' ? 'JoinDashboardGroup' : 'JoinClassificationGroup';
      } else if (hubType === 'dashboard') {
        methodName = 'JoinDashboardGroup';
      } else if (hubType === 'systemhealth') { 
        methodName = 'JoinHealthGroup'; 
      } else {
        methodName = 'JoinGroup';
      }

      await connection.invoke(methodName);
      console.log(`Successfully joined group using method: ${methodName}`);
      return true;
    } catch (error) {
      console.error(`Failed to join group ${groupName}:`, error);
      setError(error instanceof Error ? error.message : 'Failed to join group');
      return false;
    }
  }, [hubUrl, getHubType]);

  // Connect to SignalR hub
  const connect = useCallback(async (): Promise<boolean> => {
    if (isConnectingRef.current) {
      console.log('Connection attempt already in progress');
      return false;
    }

    try {
      isConnectingRef.current = true;
      console.log(`Attempting to connect to SignalR at: ${hubUrl}`);
      
      const connection = createConnection();
      
      if (connection.state === signalR.HubConnectionState.Connected) {
        setIsConnected(true);
        setConnectionState(signalR.HubConnectionState.Connected);
        
        // Auto-join group if specified
        if (autoJoinGroup && !hasJoinedGroupRef.current) {
          setTimeout(() => {
            joinGroupInternal(autoJoinGroup);
          }, 1000);
        }
        
        return true;
      }

      if (connection.state === signalR.HubConnectionState.Connecting ||
          connection.state === signalR.HubConnectionState.Reconnecting) {
        console.log('Connection already in progress, waiting...');
        return false;
      }

      setConnectionState(signalR.HubConnectionState.Connecting);
      console.log('Starting SignalR connection...');
      
      await connection.start();
      
      console.log('SignalR connection started successfully');
      setIsConnected(true);
      setConnectionState(signalR.HubConnectionState.Connected);
      setError(null);
      reconnectAttemptsRef.current = 0;
      
      onConnected?.();

      // Auto-join group if specified
      if (autoJoinGroup) {
        setTimeout(() => {
          joinGroupInternal(autoJoinGroup);
        }, 1000);
      }

      return true;
    } catch (error) {
      console.error('Failed to connect to SignalR:', error);
      console.error('Connection URL:', hubUrl);
      console.error('Error details:', error instanceof Error ? error.message : error);
      
      setIsConnected(false);
      setConnectionState(signalR.HubConnectionState.Disconnected);
      
      // Provide more specific error messages
      let errorMessage = 'Connection failed';
      if (error instanceof Error) {
        if (error.message.includes('negotiation')) {
          errorMessage = 'Cannot reach backend server. Please check if the backend is running.';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS policy error. Please check backend CORS configuration.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout. Please check network connectivity.';
        } else {
          errorMessage = `Connection failed: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      return false;
    } finally {
      isConnectingRef.current = false;
    }
  }, [createConnection, onConnected, onError, autoJoinGroup, joinGroupInternal, hubUrl]);

  // Disconnect from SignalR hub
  const disconnect = useCallback(async () => {
    try {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      const connection = connectionRef.current;
      if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
        await connection.stop();
      }
      
      connectionRef.current = null;
      setIsConnected(false);
      setConnectionState(signalR.HubConnectionState.Disconnected);
      setError(null);
      hasJoinedGroupRef.current = false;
      isConnectingRef.current = false;
    } catch (error) {
      console.error('Error disconnecting from SignalR:', error);
    }
  }, []);

  // Send message to hub
  const sendMessage = useCallback(async (method: string, ...args: any[]): Promise<boolean> => {
    try {
      const connection = connectionRef.current;
      if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
        console.warn('Cannot send message: SignalR not connected');
        return false;
      }

      await connection.invoke(method, ...args);
      return true;
    } catch (error) {
      console.error(`Failed to send message ${method}:`, error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      return false;
    }
  }, []);

  // Join a SignalR group
  const joinGroup = useCallback(async (groupName: string): Promise<boolean> => {
    return await joinGroupInternal(groupName);
  }, [joinGroupInternal]);

  // Leave a SignalR group
  const leaveGroup = useCallback(async (groupName: string): Promise<boolean> => {
    try {
      const connection = connectionRef.current;
      if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
        console.warn('Cannot leave group: SignalR not connected');
        return false;
      }

      const hubType = getHubType(hubUrl);
      const methodName = hubType === 'dashboard' ? 'LeaveDashboardGroup' : 'LeaveClassificationGroup';
      
      await connection.invoke(methodName, groupName);
      hasJoinedGroupRef.current = false;
      return true;
    } catch (error) {
      console.error(`Failed to leave group ${groupName}:`, error);
      return false;
    }
  }, [hubUrl, getHubType]);

  // Manual reconnect
  const reconnect = useCallback(async (): Promise<boolean> => {
    await disconnect();
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await connect();
  }, [disconnect, connect]);

  // Handle automatic reconnection attempts (only for unexpected disconnections) - FIXED
  useEffect(() => {
    if (!isConnected && 
        connectionState === signalR.HubConnectionState.Disconnected && 
        reconnectAttemptsRef.current > 0 && // Only if we had connected before
        reconnectAttemptsRef.current < reconnectAttempts &&
        !isConnectingRef.current &&
        autoConnect) {
      
      const handleReconnect = async () => {
        reconnectAttemptsRef.current += 1;
        console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${reconnectAttempts})`);
        
        const success = await connect();
        if (!success && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(handleReconnect, reconnectInterval);
        }
      };

      reconnectTimeoutRef.current = setTimeout(handleReconnect, reconnectInterval);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isConnected, connectionState, autoConnect]); // Removed reconnectAttempts and connect from dependencies

  // Auto-connect on mount - FIXED to prevent race conditions
  useEffect(() => {
    let mounted = true;
    
    const handleConnect = async () => {
      if (autoConnect && 
          !isConnectingRef.current && 
          connectionState === signalR.HubConnectionState.Disconnected &&
          mounted) {
        await connect();
      }
    };

    handleConnect();

    return () => {
      mounted = false;
      // Only disconnect if we're actually connected/connecting
      if (connectionRef.current && 
          (connectionRef.current.state === signalR.HubConnectionState.Connected ||
           connectionRef.current.state === signalR.HubConnectionState.Connecting)) {
        disconnect();
      }
    };
  }, []); // Empty dependency array to run only on mount

  // Update connection state when connection changes
  useEffect(() => {
    const connection = connectionRef.current;
    if (connection) {
      const updateState = () => {
        const currentState = connection.state;
        if (currentState !== connectionState) {
          setConnectionState(currentState);
          setIsConnected(currentState === signalR.HubConnectionState.Connected);
        }
      };

      updateState(); // Initial check
      const stateInterval = setInterval(updateState, 1000);
      
      return () => clearInterval(stateInterval);
    }
  }, [connectionState]);

  return {
    isConnected,
    connectionState,
    lastMessage,
    error,
    sendMessage,
    joinGroup,
    leaveGroup,
    reconnect,
  };
};

export default useSignalR;
