// frontend/src/hooks/useSystemHealth.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useSignalR } from './useSignalR';
import { SystemAlert, SystemHealth } from '../types';

interface SystemAlertExtended extends SystemAlert {
  id: number;
  severity: string;
  component: string;
  isResolved: boolean;
}

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

interface SystemHealthState {
  metrics: SystemHealthMetrics | null;
  alerts: SystemAlertExtended[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useSystemHealth = () => {
  const [state, setState] = useState<SystemHealthState>({
    metrics: null,
    alerts: [],
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const {
    health,
    isConnected,
    latestAlert,
    requestSystemStatus,
    error: signalRError
  } = useSignalR();

  // Load initial system health data
  const loadSystemHealth = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Try to request real-time status update (with retry built into signalr service)
      try {
        console.log('Requesting system status...');
        await requestSystemStatus();
        console.log('System status request successful');
      } catch (statusError) {
        console.warn('Failed to request system status, continuing with alerts:', statusError);
        // Don't fail completely, just continue with loading alerts
      }

      // Load active alerts (this is an HTTP call, not SignalR)
      console.log('Loading active alerts...');
      const alerts = await api.getActiveAlerts();
      console.log('Active alerts loaded:', alerts.length);
      
      setState(prev => ({
        ...prev,
        alerts: alerts,
        loading: false,
        lastUpdated: new Date(),
      }));

    } catch (err) {
      console.error('Failed to load system health:', err);
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load system health',
        loading: false,
      }));
    }
  }, [requestSystemStatus]);

  // Update metrics when health data changes from SignalR
  useEffect(() => {
    if (health) {
      setState(prev => ({
        ...prev,
        metrics: {
          timestamp: health.timestamp as string,
          cameraConnected: health.cameraConnected,
          arduinoConnected: health.arduinoConnected,
          cnnServiceHealthy: health.cnnServiceHealthy,
          expertSystemHealthy: health.expertSystemHealthy,
          avgProcessingTimeMs: health.avgProcessingTimeMs,
          totalItemsProcessed: health.totalItemsProcessed,
          accuracyRate: health.accuracyRate,
          classificationCounts: health.classificationCounts,
          systemUptime: health.systemUptime,
          memoryUsageMB: health.memoryUsageMB,
          cpuUsagePercent: health.cpuUsagePercent || 0,
        },
        loading: false,
      }));
    }
  }, [health]);

  // Handle new alerts from SignalR
  useEffect(() => {
    if (latestAlert) {
      const newAlert: SystemAlertExtended = {
        ...latestAlert,
        id: Date.now(), // Temporary ID for new alerts
        severity: latestAlert.level || 'info',
        component: latestAlert.component || latestAlert.source,
        isResolved: false,
      };

      setState(prev => ({
        ...prev,
        alerts: [newAlert, ...prev.alerts.slice(0, 9)], // Keep latest 10
      }));
    }
  }, [latestAlert]);

  // Load data when connection is established
  useEffect(() => {
    if (isConnected) {
      // Add a small delay to ensure connections are fully ready
      const timer = setTimeout(() => {
        console.log('Connection established, loading system health data...');
        loadSystemHealth();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, loadSystemHealth]);

  // Refresh system health data
  const refresh = useCallback(async () => {
    await loadSystemHealth();
  }, [loadSystemHealth]);

  // Resolve an alert
  const resolveAlert = useCallback(async (alertId: number, resolvedBy: string = 'Dashboard User') => {
    try {
      await api.resolveAlert(alertId, resolvedBy);
      setState(prev => ({
        ...prev,
        alerts: prev.alerts.filter(alert => alert.id !== alertId),
      }));
      return true;
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to resolve alert',
      }));
      return false;
    }
  }, []);

  // Get system health summary
  const getHealthSummary = useCallback(() => {
    if (!state.metrics) {
      return {
        overallHealthy: false,
        healthyComponents: 0,
        warningComponents: 0,
        errorComponents: 0,
        totalComponents: 0,
      };
    }

    const components = [
      { name: 'CNN Service', healthy: state.metrics.cnnServiceHealthy },
      { name: 'Expert System', healthy: state.metrics.expertSystemHealthy },
      { name: 'Camera', healthy: state.metrics.cameraConnected },
      { name: 'Arduino', healthy: state.metrics.arduinoConnected },
      { name: 'Network', healthy: isConnected },
      { name: 'Memory', healthy: state.metrics.memoryUsageMB < 8000 }, // 8GB threshold
    ];

    const healthyComponents = components.filter(c => c.healthy).length;
    const errorComponents = components.filter(c => !c.healthy).length;
    const warningComponents = 0; // Could add logic for warning states

    return {
      overallHealthy: errorComponents === 0,
      healthyComponents,
      warningComponents,
      errorComponents,
      totalComponents: components.length,
    };
  }, [state.metrics, isConnected]);

  return {
    // State
    metrics: state.metrics,
    alerts: state.alerts,
    loading: state.loading,
    error: state.error || signalRError,
    lastUpdated: state.lastUpdated,
    isConnected,
    
    // Computed values
    healthSummary: getHealthSummary(),
    
    // Actions
    refresh,
    resolveAlert,
  };
};
