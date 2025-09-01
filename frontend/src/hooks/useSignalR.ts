import { useState, useEffect, useCallback, useRef } from 'react';
import signalRService from '../services/signalr';
import { 
  ClassificationResult, 
  ClassificationTriggeredMessage,
  SystemAlert,
  DashboardUpdate,
  SystemStats,
  SystemHealth 
} from '../types';

interface SignalRState {
  connected: {
    classification: boolean;
    dashboard: boolean;
  };
  connectionAttempts: number;
  lastConnectionTime: Date | null;
  latestClassification: ClassificationResult | null;
  latestTrigger: ClassificationTriggeredMessage | null;
  latestAlert: SystemAlert | null;
  latestDashboardUpdate: DashboardUpdate | null;
  stats: SystemStats;
  health: SystemHealth;
  isLoading: boolean;
  error: string | null;
}

// Default values using camelCase to match API
const defaultStats: SystemStats = {
  totalItems: 0,
  accuracyRate: 0,
  avgProcessingTime: 0,
  classificationBreakdown: {},
  overrideRate: 0,
  itemsToday: 0,
  itemsThisWeek: 0,
  itemsThisMonth: 0,
  lastClassification: new Date(),
  hourlyBreakdown: []
};

const defaultHealth: SystemHealth = {
  timestamp: new Date(),
  cameraConnected: false,
  arduinoConnected: false,
  cnnServiceHealthy: false,
  expertSystemHealthy: false,
  avgProcessingTimeMs: 0,
  totalItemsProcessed: 0,
  accuracyRate: 0,
  classificationCounts: {},
  systemUptime: 0,
  memoryUsageMB: 0,
  cpuUsagePercent: 0,
  isHealthy: false
};

export const useSignalR = () => {
  const [state, setState] = useState<SignalRState>({
    connected: {
      classification: false,
      dashboard: false,
    },
    connectionAttempts: 0,
    lastConnectionTime: null,
    latestClassification: null,
    latestTrigger: null,
    latestAlert: null,
    latestDashboardUpdate: null,
    stats: defaultStats,
    health: defaultHealth,
    isLoading: true,
    error: null,
  });

  const initializationRef = useRef<{
    initialized: boolean;
    initPromise: Promise<void> | null;
    cleanup: (() => Promise<void>) | null;
  }>({
    initialized: false,
    initPromise: null,
    cleanup: null
  });

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const connectionCheckInterval = useRef<NodeJS.Timeout | undefined>(undefined);

  // Connection state change handler with improved error handling
  const handleConnectionStateChange = useCallback((connected: boolean, hubName: string) => {
    console.log(`useSignalR: ${hubName} hub connection state changed:`, connected);
    
    setState(prev => {
      const newConnectedState = {
        ...prev.connected,
        [hubName]: connected,
      };
      
      const isFullyConnected = newConnectedState.classification && newConnectedState.dashboard;
      
      return {
        ...prev,
        connected: newConnectedState,
        lastConnectionTime: connected ? new Date() : prev.lastConnectionTime,
        error: !isFullyConnected && !prev.isLoading ? 
          `Connection issue: ${hubName} hub ${connected ? 'connected' : 'disconnected'}` : 
          null,
        isLoading: false,
      };
    });

    if (connected) {
      console.log(`useSignalR: ${hubName} hub connected successfully`);
    } else {
      console.log(`useSignalR: ${hubName} hub disconnected`);
    }
  }, []);

  // Classification result handler with better data processing
  const handleClassificationResult = useCallback((result: any) => {
    try {
      // Handle both ClassificationResult and ClassificationResponseDto formats
      const classification: ClassificationResult = {
        id: result.Id || result.id || 0,
        timestamp: result.Timestamp || result.timestamp || new Date(),
        finalClassification: result.FinalClassification || result.finalClassification || 'unknown',
        finalConfidence: result.FinalConfidence || result.finalConfidence || 0,
        disposalLocation: result.DisposalLocation || result.disposalLocation || 'unknown',
        processingTime: result.ProcessingTimeMs || result.processingTime || 0,
        isOverridden: result.IsOverridden || result.isOverridden || false,
        validationResults: result.ValidationResults || result.validationResults,
        // Add additional properties with safe defaults
        cnnPredictedClass: result.CnnPredictedClass || result.cnnPredictedClass,
        cnnConfidence: result.CnnConfidence || result.cnnConfidence,
        weightGrams: result.WeightGrams || result.weightGrams || 0,
        reasoning: result.Reasoning || result.reasoning
      };

      setState(prev => ({
        ...prev,
        latestClassification: classification,
      }));
    } catch (error) {
      console.error('Error processing classification result:', error);
    }
  }, []);

  // Dashboard update handler with improved data processing
  const handleDashboardUpdate = useCallback((update: DashboardUpdate) => {
    try {
      setState(prev => {
        const newState = {
          ...prev,
          latestDashboardUpdate: update,
        };

        // Handle different types of dashboard updates
        switch (update.type) {
          case 'stats':
            newState.stats = {
              ...defaultStats,
              ...update.data,
            };
            break;
        
          case 'status':
          case 'initial_status': {
            const healthData = update.type === 'status' ? update.data : update.data?.healthMetrics;
            const statsData = update.data?.stats;
            if (healthData) {
                // *** THE FIX: Manually construct the health object ***
                newState.health = {
                  timestamp: healthData.timestamp || prev.health.timestamp,
                  cameraConnected: healthData.cameraConnected,
                  arduinoConnected: healthData.arduinoConnected,
                  cnnServiceHealthy: healthData.cnnServiceHealthy,
                  expertSystemHealthy: healthData.expertSystemHealthy,
                  avgProcessingTimeMs: healthData.avgProcessingTimeMs,
                  totalItemsProcessed: healthData.totalItemsProcessed,
                  accuracyRate: healthData.accuracyRate,
                  classificationCounts: healthData.classificationCounts || prev.health.classificationCounts,
                  systemUptime: healthData.systemUptime,
                  memoryUsageMB: healthData.memoryUsageMB,
                  cpuUsagePercent: healthData.cpuUsagePercent || 0,
                  isHealthy: healthData.cnnServiceHealthy && healthData.expertSystemHealthy && healthData.cameraConnected && healthData.arduinoConnected,
                };
            }
            if (statsData) {
              newState.stats = { ...defaultStats, ...statsData };
            }
            break;
          }
        
          case 'alert':
            newState.latestAlert = update.data;
            break;

          case 'classification':
            if (update.data) {
              newState.latestClassification = update.data;
            }
            break;
        }
        
        console.log("Updated state from dashboard update:", newState);
        return newState;
      });
    } catch (error) {
      console.error('Error processing dashboard update:', error);
    }
  }, []);

  // System alert handler
  const handleSystemAlert = useCallback((alert: SystemAlert) => {
    setState(prev => ({
      ...prev,
      latestAlert: alert,
    }));
  }, []);

  // Classification triggered handler  
  const handleClassificationTriggered = useCallback((data: ClassificationTriggeredMessage) => {
    setState(prev => ({
      ...prev,
      latestTrigger: data,
    }));
  }, []);

  // Initialize connections with better state management
  const initializeConnections = useCallback(async (): Promise<void> => {
    // Prevent multiple initializations
    if (initializationRef.current.initialized) {
      console.log('useSignalR: Already initialized, skipping...');
      return;
    }

    // Return existing promise if initialization is in progress
    if (initializationRef.current.initPromise) {
      console.log('useSignalR: Initialization in progress, waiting...');
      return initializationRef.current.initPromise;
    }

    // Create initialization promise
    initializationRef.current.initPromise = (async () => {
      try {
        setState(prev => ({
          ...prev,
          connectionAttempts: prev.connectionAttempts + 1,
          isLoading: true,
          error: null,
        }));

        console.log('useSignalR: Setting up event handlers...');
        
        // Set up event handlers before connecting
        signalRService.onConnectionStateChange(handleConnectionStateChange);
        signalRService.onClassificationResultReceived(handleClassificationResult);
        signalRService.onClassificationTriggeredReceived(handleClassificationTriggered);
        signalRService.onSystemAlertReceived(handleSystemAlert);
        signalRService.onDashboardUpdateReceived(handleDashboardUpdate);

        console.log('useSignalR: Starting connection process...');

        // Start connections with improved error handling
        const connectionResults = await Promise.allSettled([
          signalRService.startClassificationHub(),
          signalRService.startDashboardHub()
        ]);

        // Check if at least one connection succeeded
        const hasConnection = connectionResults.some(result => result.status === 'fulfilled');
        
        if (!hasConnection) {
          throw new Error('Failed to establish any SignalR connections');
        }

        // Check connection health
        const healthCheck = await signalRService.checkConnectionHealth();
        console.log('useSignalR: Connection health check:', healthCheck);

        initializationRef.current.initialized = true;

        // Request initial data after connections are stable
        setTimeout(async () => {
          try {
            if (signalRService.dashboardConnected) {
              console.log('useSignalR: Requesting initial data...');
              await requestSystemStatus();
              await requestStats();
              console.log('useSignalR: Initial data requests completed');
            } else {
              console.warn('useSignalR: Dashboard hub not ready for initial data requests');
            }
          } catch (error) {
            console.error('useSignalR: Failed to request initial data:', error);
            setState(prev => ({
              ...prev,
              error: 'Failed to load initial data'
            }));
          }
        }, 2000); // Reduced delay

      } catch (error) {
        console.error('useSignalR: Failed to initialize connections:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Connection initialization failed',
          isLoading: false,
        }));

        // Schedule reconnect attempt with exponential backoff
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        const backoffDelay = Math.min(1000 * Math.pow(2, state.connectionAttempts), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('useSignalR: Attempting reconnect...');
          reconnect();
        }, backoffDelay);
      } finally {
        // Clear the promise reference
        initializationRef.current.initPromise = null;
      }
    })();

    return initializationRef.current.initPromise;
  }, [handleConnectionStateChange, handleClassificationResult, handleClassificationTriggered, handleSystemAlert, handleDashboardUpdate, state.connectionAttempts]);

  // Connection health monitoring
  const startConnectionMonitoring = useCallback(() => {
    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
    }

    connectionCheckInterval.current = setInterval(async () => {
      try {
        const health = await signalRService.checkConnectionHealth();
        
        // Update connection state if there's a mismatch
        setState(prev => {
          const currentState = prev.connected;
          if (currentState.classification !== health.classification || 
              currentState.dashboard !== health.dashboard) {
            console.log('useSignalR: Connection state mismatch detected, updating...');
            return {
              ...prev,
              connected: {
                classification: health.classification,
                dashboard: health.dashboard
              }
            };
          }
          return prev;
        });
      } catch (error) {
        console.error('useSignalR: Connection health check failed:', error);
      }
    }, 15000); // Check every 15 seconds
  }, []);

  // Cleanup function
  const cleanup = useCallback(async () => {
    console.log('useSignalR: Cleaning up...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (connectionCheckInterval.current) {
      clearInterval(connectionCheckInterval.current);
      connectionCheckInterval.current = undefined;
    }
    
    try {
      await signalRService.stopConnections();
    } catch (error) {
      console.error('useSignalR: Error stopping connections:', error);
    }
    
    // Reset initialization state
    initializationRef.current = {
      initialized: false,
      initPromise: null,
      cleanup: null
    };
  }, []);

  // Effect to initialize connections with proper cleanup
  useEffect(() => {
    console.log('useSignalR: Effect triggered - initializing...');
    
    const init = async () => {
      await initializeConnections();
      startConnectionMonitoring();
    };

    init().catch(console.error);

    // Store cleanup function
    initializationRef.current.cleanup = cleanup;

    // Cleanup on unmount or deps change
    return () => {
      if (initializationRef.current.cleanup) {
        initializationRef.current.cleanup();
      }
    };
  }, []); // Empty dependency array - only run once

  // Manual reconnect function
  const reconnect = useCallback(async () => {
    console.log('useSignalR: Manual reconnect requested...');
    
    // Reset initialization state
    initializationRef.current.initialized = false;
    initializationRef.current.initPromise = null;
    
    await cleanup();
    await initializeConnections();
    startConnectionMonitoring();
  }, [cleanup, initializeConnections, startConnectionMonitoring]);

  const requestSystemStatus = useCallback(async () => {
    try {
      console.log('useSignalR: Requesting system status...');
      await signalRService.requestSystemStatus();
      console.log('useSignalR: System status request completed');
    } catch (error) {
      console.error('useSignalR: Failed to request system status:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to request system status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
      throw error;
    }
  }, []);

  const requestStats = useCallback(async (fromDate?: Date, toDate?: Date) => {
    try {
      console.log('useSignalR: Requesting stats...');
      await signalRService.requestStats(fromDate, toDate);
      console.log('useSignalR: Stats request completed');
    } catch (error) {
      console.error('useSignalR: Failed to request stats:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to request stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
      throw error;
    }
  }, []);

  // Send manual override
  const sendManualOverride = useCallback(async (
    classificationId: number,
    newClassification: string,
    newDisposalLocation: string,
    reason: string,
    userId: string = 'Dashboard'
  ) => {
    try {
      await signalRService.sendManualOverride(classificationId, newClassification, reason);
    } catch (error) {
      console.error('useSignalR: Failed to send manual override:', error);
      throw error;
    }
  }, []);

  // Connection status getters
  const isFullyConnected = state.connected.classification && state.connected.dashboard;

  return {
    // Connection status
    connected: state.connected,
    isConnected: isFullyConnected,
    connectionAttempts: state.connectionAttempts,
    lastConnectionTime: state.lastConnectionTime,
    isLoading: state.isLoading,
    error: state.error,

    // Data
    latestClassification: state.latestClassification,
    latestTrigger: state.latestTrigger,
    latestAlert: state.latestAlert,
    latestDashboardUpdate: state.latestDashboardUpdate,
    stats: state.stats,
    health: state.health,

    // Actions
    reconnect,
    requestSystemStatus,
    requestStats,
    sendManualOverride,
  };
};
