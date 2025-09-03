// hooks/index.ts - Main hooks export file

// Base SignalR hook (generic)
export { default as useSignalR } from './useSignalR';

// Specialized hooks for different features
export { useDashboard } from './useDashboard';
export { useClassificationHistory } from './useClassificationHistory';
export { useSystemHealth } from './useSystemHealth';
export { useLiveClassification } from './useLiveClassification';

// API hook
export { default as useApi } from './useApi';

// Type exports
export type { UseSignalRReturn } from './useSignalR';

// Hook type definitions for specialized hooks
export interface DashboardHook {
  connected: boolean;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  stats: any;
  health: any;
  latestClassification: any;
  latestAlert: any;
  reconnect: () => Promise<boolean>;
  requestSystemStatus: () => Promise<void>;
  requestStats: () => Promise<void>;
  refresh: () => Promise<void>;
}

export interface ClassificationHistoryHook {
  classifications: any[];
  latestClassification: any;
  totalCount: number;
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchClassifications: (criteria?: any) => Promise<void>;
  refreshData: () => Promise<void>;
  changePage: (page: number) => Promise<void>;
  clearError: () => void;
}

export interface SystemHealthHook {
  health: any;
  metrics: any;
  alerts: any[];
  latestAlert: any;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  requestSystemStatus: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  clearAlert: (alertId: string) => void;
  clearAllAlerts: () => void;
  reconnect: () => Promise<boolean>;
}

export interface LiveClassificationHook {
  currentClassification: any;
  previousClassifications: any[];
  isProcessing: boolean;
  systemStatus: any;
  error: string | null;
  lastUpdate: Date | null;
  overrideClassification: (overrideData: any) => Promise<boolean>;
  approveClassification: (classificationId: number) => Promise<boolean>;
  rejectClassification: (classificationId: number, reason: string) => Promise<boolean>;
  requestReclassification: (detectionId: string) => Promise<boolean>;
  triggerManualCapture: () => Promise<boolean>;
  clearError: () => void;
  refreshCurrentClassification: () => Promise<void>;
}
