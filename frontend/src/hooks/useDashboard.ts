import { useState, useEffect, useCallback } from 'react';
import useSignalR from './useSignalR';
import apiService, { DashboardStats, SystemStatus, ClassificationResult } from '../services/api';

interface DashboardHook {
  // Connection state
  connected: boolean;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Data
  stats: DashboardStats | null;
  health: SystemStatus | null;
  latestClassification: ClassificationResult | null;
  latestAlert: string | null;

  // Actions
  reconnect: () => Promise<boolean>;
  requestSystemStatus: () => Promise<void>;
  requestStats: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useDashboard = (): DashboardHook => {
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<SystemStatus | null>(null);
  const [latestClassification, setLatestClassification] = useState<ClassificationResult | null>(null);
  const [latestAlert, setLatestAlert] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // SignalR connection with proper configuration
  const {
    isConnected,
    lastMessage,
    error: signalRError,
    reconnect: signalRReconnect,
    sendMessage,
  } = useSignalR(
    `${process.env.REACT_APP_WS_URL}/hubs/dashboard`,
    {
      autoConnect: true,
      autoJoinGroup: 'Dashboard', // Auto-join Dashboard group
      reconnectAttempts: 5,
      reconnectInterval: 3000,
      onConnected: () => {
        console.log('Dashboard SignalR connected');
        setDashboardError(null);
        // Load initial data after connection
        setTimeout(() => {
          loadInitialData();
        }, 500);
      },
      onDisconnected: (error) => {
        console.log('Dashboard SignalR disconnected:', error?.message);
        setDashboardError(error?.message || 'Connection lost');
      },
      onError: (error) => {
        console.error('Dashboard SignalR error:', error);
        setDashboardError(error.message);
      },
    }
  );

  // Load initial data from API
  const loadInitialData = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const [statsData, healthData, recentClassification] = await Promise.allSettled([
        apiService.getDashboardStats(),
        apiService.getSystemStatus(),
        apiService.getClassifications({ limit: 1, sortBy: 'timestamp', sortDescending: true })
      ]);

      if (statsData.status === 'fulfilled') {
        setStats(statsData.value);
      }

      if (healthData.status === 'fulfilled') {
        setHealth(healthData.value);
      }

      console.error("items are", recentClassification);
      if (recentClassification.status === 'fulfilled' && recentClassification.value.items.length > 0) {
        setLatestClassification(recentClassification.value.items[0]);
      }
    } catch (error) {
      console.error('Error loading initial dashboard data:', error);
      setDashboardError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // Handle SignalR messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'classification_result':
        setLatestClassification(data);
        // Note: Can't update totalClassifications as it's not in DashboardStats
        // The stats will be updated via other SignalR messages or API calls
        break;
      
      case 'dashboard_update':
        console.log('Dashboard update received:', data);
        // Handle different types of dashboard updates
        if (data.type === 'stats' && data.data) {
          setStats(data.data);
        } else if (data.type === 'status' && data.data) {
          setHealth(data.data);
        } else if (data.type === 'initial_status' && data.data) {
          if (data.data.stats) {
            setStats(data.data.stats);
          }
          if (data.data.healthMetrics) {
            setHealth(data.data.HealthMetrics);
          }
        }
        break;
      
      case 'system_status':
        setHealth(data);
        break;
      
      case 'classification_overridden':
        // Update the classification if it matches our latest one
        if (latestClassification && latestClassification.id === data.classificationId) {
          setLatestClassification(prev => prev ? {
            ...prev,
            isOverridden: true,
            overrideReason: data.reason,
            overrideClassification: data.newClassification
          } : prev);
        }
        break;
      
      case 'error':
        setLatestAlert(data.message);
        setDashboardError(data.message);
        break;
      
      default:
        console.log('Unhandled dashboard message type:', type, data);
    }
  }, [lastMessage, stats, latestClassification]);

  // Request system status from the hub
  const requestSystemStatus = useCallback(async () => {
    if (!isConnected) {
      console.warn('Cannot request system status: not connected');
      return;
    }

    try {
      const success = await sendMessage('RequestSystemStatus');
      if (!success) {
        console.warn('Failed to request system status via SignalR');
        // Fallback to API
        const health = await apiService.getSystemStatus();
        setHealth(health);
      }
    } catch (error) {
      console.error('Error requesting system status:', error);
      // Fallback to API
      try {
        const health = await apiService.getSystemStatus();
        setHealth(health);
      } catch (apiError) {
        setDashboardError('Failed to get system status');
      }
    }
  }, [isConnected, sendMessage]);

  // Request stats from the hub
  const requestStats = useCallback(async (fromDate: Date | null = null, toDate: Date | null = null) => {
    if (!isConnected) {
      console.warn('Cannot request stats: not connected');
      return;
    }
    try {
      const success = await sendMessage('RequestStats', fromDate, toDate);
      if (!success) {
        console.warn('Failed to request stats via SignalR, falling back to API');
        const stats = await apiService.getDashboardStats();
        setStats(stats);
      }
    } catch (error) {
      console.error('Error requesting stats:', error);
      try {
        const stats = await apiService.getDashboardStats();
        setStats(stats);
      } catch (apiError) {
        setDashboardError('Failed to get dashboard stats');
      }
    }
  }, [isConnected, sendMessage]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setDashboardError(null);
    
    try {
      if (isConnected) {
        // Use SignalR to request fresh data
        await Promise.all([
          requestSystemStatus(),
          requestStats()
        ]);
      } else {
        // Fallback to API
        await loadInitialData();
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      setDashboardError('Failed to refresh dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, requestSystemStatus, requestStats, loadInitialData]);

  // Reconnect function
  const reconnect = useCallback(async (): Promise<boolean> => {
    setDashboardError(null);
    const success = await signalRReconnect();
    if (!success) {
      setDashboardError('Failed to reconnect to dashboard service');
    }
    return success;
  }, [signalRReconnect]);

  // Clear alerts after some time
  useEffect(() => {
    if (latestAlert) {
      const timeout = setTimeout(() => {
        setLatestAlert(null);
      }, 10000); // Clear alert after 10 seconds

      return () => clearTimeout(timeout);
    }
  }, [latestAlert]);

  // Combine errors
  const combinedError = dashboardError || signalRError;

  return {
    // Connection state
    connected: isConnected,
    isConnected,
    isLoading,
    error: combinedError,

    // Data
    stats,
    health,
    latestClassification,
    latestAlert,

    // Actions
    reconnect,
    requestSystemStatus,
    requestStats,
    refresh,
  };
};
