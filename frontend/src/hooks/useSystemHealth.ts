import { useState, useEffect, useCallback, useMemo } from 'react';
import useSignalR from './useSignalR';
import apiService, { SystemStatus, SystemAlert } from '../services/api';

interface SystemHealthMetrics {
  timestamp: string;
  cameraConnected: boolean;
  arduinoConnected: boolean;
  cnnServiceHealthy: boolean;
  expertSystemHealthy: boolean;
  avgProcessingTimeMs: number;
  totalItemsProcessed: number;
  accuracyRate: number;
  classificationCounts: { [key: string]: number };
  systemUptime: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
}

interface UseSystemHealthReturn {
  // System health data
  health: SystemStatus | null;
  healthSummary: any;
  metrics: SystemHealthMetrics | null;
  alerts: SystemAlert[];
  latestAlert: SystemAlert | null;
  
  // Connection state
  isConnected: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  resolveAlert: (alertId: number) => void;
  clearAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  reconnect: () => Promise<boolean>;
}

export const useSystemHealth = (): UseSystemHealthReturn => {
  // State management
  const [health, setHealth] = useState<SystemStatus | null>(null);
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [latestAlert, setLatestAlert] = useState<SystemAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Create health summary with component counts
  const healthSummary = useMemo(() => {
    if (!health) {
      return {
        healthyComponents: 0,
        warningComponents: 0,
        errorComponents: 4, // Assume all are down initially
        overall: 'error',
      };
    }
    const components = [
      health.cameraConnected,
      health.cnnServiceHealthy,
      health.arduinoConnected,
      health.expertSystemHealthy,
    ];
    const healthyCount = components.filter(c => c === true).length;
    const errorCount = components.filter(c => c === false).length;

    let overallStatus = 'healthy';
    if (errorCount > 0) {
        overallStatus = 'error';
    } else if (healthyCount < components.length) {
        overallStatus = 'warning';
    }

    return {
      healthyComponents: healthyCount,
      warningComponents: 0, // No specific warning logic currently
      errorComponents: errorCount,
      overall: overallStatus,
    };
  }, [health]);

  // SignalR connection - Fixed to use new signature
  const {
    isConnected,
    lastMessage,
    error: signalRError,
    reconnect: signalRReconnect
  } = useSignalR(
    `${process.env.REACT_APP_WS_URL}/hubs/systemhealth`,
    {
      autoConnect: true,
      autoJoinGroup: 'systemhealth', // Auto-join Classification group
      reconnectAttempts: 3,
      reconnectInterval: 5000,
      onConnected: () => {
        console.log('System Health SignalR connected');
        loadSystemHealth();
      },
      onError: (error: Error) => {
        setHealthError(error.message);
      },
    }
  );

  // Handle SignalR messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data, timestamp } = lastMessage;

    console.error("HELL");
    console.error(type, data, timestamp);
    switch (type) {
      case 'InitialHealthStatus':
        console.log('Handling InitialHealthStatus in hook:', data);
        setMetrics(data); 
        break;

      case 'HealthUpdate':
          console.log('Received health update:', data);
          setMetrics(data);
          break;

      case 'SystemAlert':
          console.log('Received system alert:', data);
          setAlerts(prev => [data, ...prev.slice(0, 19)]);
          break;

      case 'system_status':
        setHealth(data);
        break;
      
      case 'system_metrics':
        setMetrics(data);
        break;
      
      case 'system_alert':
        const alert: SystemAlert = {
          id: parseInt(data.id) || Date.now(),
          timestamp: timestamp,
          // level: data.level || 'info',
          severity: data.level || 'info',
          source: data.source || 'system',
          component: data.source || 'system',
          message: data.message || 'System alert',
          isResolved: false,
        };
        
        setAlerts(prev => [alert, ...prev.slice(0, 19)]);
        setLatestAlert(alert);
        break;
      
      case 'alert_resolved':
        setAlerts(prev => prev.map(alert => 
          alert.id === data.alertId 
            ? { ...alert, resolved: true }
            : alert
        ));
        break;
      
      case 'error':
        setHealthError(data.message || 'System error');
        break;
    }
  }, [lastMessage]);

  // Load system health data
  const loadSystemHealth = useCallback(async () => {
    setLoading(true);
    setHealthError(null);

    try {
      const [systemStatus, activeAlerts] = await Promise.all([
        apiService.getSystemStatus(),
        apiService.getActiveAlerts()
      ]);
      setHealth(systemStatus); 
      setAlerts(activeAlerts);
    } catch (error) {
      console.error('Failed to load system health:', error);
      setHealthError(error instanceof Error ? error.message : 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear specific alert
  const clearAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id.toString() !== alertId));
    
    if (latestAlert && latestAlert.id.toString() === alertId) {
      const remaining = alerts.filter(alert => alert.id.toString() !== alertId);
      setLatestAlert(remaining.length > 0 ? remaining[0] : null);
    }
  }, [alerts, latestAlert]);

  // Resolve alert (compatibility method)
  const resolveAlert = useCallback((alertId: number) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, resolved: true }
        : alert
    ));
    
    if (latestAlert && latestAlert.id === alertId) {
      setLatestAlert(prev => prev ? { ...prev, resolved: true } : null);
    }
  }, [latestAlert]);

  // Refresh health data (compatibility method)
  const refresh = useCallback(async () => {
    console.log("Refreshing system health via REST API...");
    await loadSystemHealth();
  }, [loadSystemHealth]);

  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
    setLatestAlert(null);
  }, []);

  // Reconnect wrapper
  const reconnect = useCallback(async (): Promise<boolean> => {
    const success = await signalRReconnect();
    if (success) {
      await loadSystemHealth();
    }
    return success;
  }, [signalRReconnect, loadSystemHealth]);

  // Load initial data on mount
  useEffect(() => {
    loadSystemHealth();
  }, [loadSystemHealth]);

  // Auto-refresh when connected
  useEffect(() => {
    if (isConnected) {
      loadSystemHealth();
    }
  }, [isConnected, loadSystemHealth]);

  // Periodic health checks
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      // requestSystemStatus();
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [isConnected /*, requestSystemStatus */]);

  // Generate sample alerts for testing
  useEffect(() => {
    // Create a sample alert on connection for demonstration
    if (isConnected && alerts.length === 0) {
      const sampleAlert: SystemAlert = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        // level: 'info',
        severity: 'info',
        source: 'system',
        component: 'system',
        message: 'System health monitoring active',
        isResolved: false,
      };
      
      setAlerts([sampleAlert]);
      setLatestAlert(sampleAlert);
    }
  }, [isConnected, alerts.length]);

  // Combine errors
  const combinedError = healthError || signalRError;

  return {
    // System health data
    health,
    healthSummary,
    metrics,
    alerts,
    latestAlert,
    
    // Connection state
    isConnected,
    loading,
    error: combinedError,
    
    // Actions
    refresh,
    resolveAlert,
    clearAlert,
    clearAllAlerts,
    reconnect,
  };
};

