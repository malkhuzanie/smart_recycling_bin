import axios from 'axios';
import { ClassificationResult, DashboardStats, SystemStatus, ManualOverrideRequest } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5099';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    if (error.response?.status === 401) {
      // Handle unauthorized access
      console.warn('Unauthorized access detected');
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Classification endpoints
  getRecentClassifications: async (page = 1, pageSize = 50, filterBy?: string): Promise<{
    items: ClassificationResult[];
    totalCount: number;
    totalPages: number;
  }> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    
    if (filterBy) {
      params.append('filterBy', filterBy);
    }
    
    const response = await apiClient.get(`/api/classification/recent?${params}`);
    return response.data;
  },

  getClassificationById: async (id: number): Promise<ClassificationResult> => {
    const response = await apiClient.get(`/api/classification/${id}`);
    return response.data;
  },

  applyManualOverride: async (request: ManualOverrideRequest): Promise<void> => {
    await apiClient.post('/api/classification/override', request);
  },

  exportClassifications: async (fromDate?: Date, toDate?: Date): Promise<Blob> => {
    const params = new URLSearchParams();
    
    if (fromDate) {
      params.append('fromDate', fromDate.toISOString());
    }
    
    if (toDate) {
      params.append('toDate', toDate.toISOString());
    }
    
    const response = await apiClient.get(`/api/classification/export?${params}`, {
      responseType: 'blob',
    });
    
    return response.data;
  },

  // Dashboard endpoints
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get('/api/dashboard/stats');
    return response.data;
  },

  getSystemStatus: async (): Promise<SystemStatus> => {
    const response = await apiClient.get('/api/dashboard/status');
    return response.data;
  },

  getPerformanceMetrics: async (hours = 24): Promise<any> => {
    const response = await apiClient.get(`/api/dashboard/performance?hours=${hours}`);
    return response.data;
  },

  // System Health endpoints - NEW
  getSystemHealth: async (): Promise<any> => {
    const response = await apiClient.get('/api/system/health');
    return response.data;
  },

  getActiveAlerts: async (): Promise<any[]> => {
    const response = await apiClient.get('/api/system/alerts');
    return response.data;
  },

  getSystemMetrics: async (fromDate?: Date): Promise<any> => {
    const params = new URLSearchParams();
    
    if (fromDate) {
      params.append('fromDate', fromDate.toISOString());
    }
    
    const response = await apiClient.get(`/api/system/metrics?${params}`);
    return response.data;
  },

  resolveAlert: async (alertId: number, resolvedBy: string): Promise<void> => {
    await apiClient.post(`/api/system/alerts/${alertId}/resolve`, {
      resolvedBy: resolvedBy
    });
  },

  // Health endpoints
  getHealthCheck: async (): Promise<any> => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  getDetailedHealthCheck: async (): Promise<any> => {
    const response = await apiClient.get('/api/health/detailed');
    return response.data;
  },

  // Statistics
  getStatistics: async (fromDate?: Date, toDate?: Date): Promise<any> => {
    const params = new URLSearchParams();
    
    if (fromDate) {
      params.append('fromDate', fromDate.toISOString());
    }
    
    if (toDate) {
      params.append('toDate', toDate.toISOString());
    }
    
    const response = await apiClient.get(`/api/classification/statistics?${params}`);
    return response.data;
  },
};

export default api;
