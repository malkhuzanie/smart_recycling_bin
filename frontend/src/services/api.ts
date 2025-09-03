// frontend/src/services/api.ts 
import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface ClassificationResult {
  id: number;
  detectionId: string;
  timestamp: string;
  finalClassification: string;
  finalConfidence: number;
  disposalLocation: string;
  reasoning: string;
  processingTimeMs: number;
  
  imageBase64?: string;
  hasImage: boolean;
  imageCaptureTimestamp?: string;
  imageFormat?: string;
  imageDimensions?: string;
  imageSizeBytes?: number;
  
  isOverridden: boolean;
  
  // CNN data
  cnnPredictedClass: string;
  cnnConfidence: number;
  cnnStage: number;
  
  // Enhanced fields for Live Classification
  cnnStages?: {
    stage1Result?: {
      predictedClass: string;
      confidence: number;
    };
    stage2Result?: {
      predictedClass: string;
      confidence: number;
    };
    totalConfidence: number;
  };
  
  sensorData?: {
    weightGrams: number;
    isMetalDetected: boolean;
    humidityPercent: number;
    temperatureCelsius: number;
    isMoist: boolean;
    isTransparent: boolean;
    isFlexible: boolean;
  };
  
  validationResults?: {
    [key: string]: string;
  };
  
  // Processing info
  processingPipeline?: string[];
  metadata?: {
    [key: string]: any;
  };
}

interface DashboardStats {
  itemsToday: number;
  itemsThisWeek: number;
  overrideRate: number;
  averageConfidence: number;
  averageProcessingTime: number;
  classificationBreakdown: { [key: string]: number };
  hourlyThroughput: { [key: string]: number };
  systemStatus: SystemStatus;
  recentAlerts: string[];
  
  // IMAGE STATISTICS
  imagesStoredToday?: number;
  totalImageStorageSize?: number;
  averageImageSize?: number;
}

interface SystemStatus {
  isConnected: boolean;
  lastUpdate: string;
  cameraConnected: boolean;
  cnnServiceHealthy: boolean;
  arduinoConnected: boolean;
  expertSystemHealthy: boolean;
  itemsInQueue: number;
  isProcessing: boolean;
  imageStorageEnabled: boolean;
  additionalInfo: { [key: string]: any };
}

interface OverrideRequest {
  classificationId: number;
  newClassification: string;
  reason: string;
  userId: string;
}

interface SearchCriteria {
  fromDate?: string;
  toDate?: string;
  classification?: string;
  minConfidence?: number;
  maxConfidence?: number;
  isOverridden?: boolean;
  hasImage?: boolean;        // Filter by image presence
  detectionId?: string;      // Search by detection ID
  minImageSize?: number;     // Filter by image size
  maxImageSize?: number;     // Filter by image size
  imageFormat?: string;      // Filter by image format
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDescending?: boolean;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Image storage statistics
interface ImageStorageStats {
  totalImagesStored: number;
  totalStorageSizeBytes: number;
  averageImageSizeBytes: number;
  oldestImageDate?: string;
  newestImageDate?: string;
  totalStorageSizeMB: number;
  averageImageSizeMB: number;
}

class APIService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5099',
      timeout: 30000, // Increased timeout for image transfers
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('🚨 API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        const responseSize = JSON.stringify(response.data).length;
        console.log(`✅ API Response: ${response.status} (${responseSize} chars)`);
        return response;
      },
      (error) => {
        console.error('🚨 API Response Error:', error?.response?.status, error?.response?.data);
        return Promise.reject(error);
      }
    );
  }

  // Classification Management
  async getClassifications(criteria: SearchCriteria = {}): Promise<PagedResult<ClassificationResult>> {
    try {
      const response = await this.api.get<PagedResult<ClassificationResult>>(
        '/api/classification/recent',
        { params: criteria }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch classifications:', error);
      throw error;
    }
  }

  async getClassificationById(id: number): Promise<ClassificationResult> {
    try {
      const response = await this.api.get<ClassificationResult>(`/api/classification/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch classification ${id}:`, error);
      throw error;
    }
  }

  // IMAGE SPECIFIC METHODS
  async getClassificationImage(id: number): Promise<string | null> {
    try {
      const response = await this.api.get<{imageBase64: string}>(`/api/classification/${id}/image`);
      return response.data.imageBase64 || null;
    } catch (error) {
      console.error(`Failed to fetch image for classification ${id}:`, error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // No image available
      }
      throw error;
    }
  }

  async downloadClassificationImage(id: number): Promise<void> {
    try {
      const response = await this.api.get(`/api/classification/${id}/image/download`, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data]);
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      
      // Extract filename from Content-Disposition header or create default
      const contentDisposition = response.headers['content-disposition'];
      let filename = `classification_${id}_image.jpg`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error(`Failed to download image for classification ${id}:`, error);
      throw error;
    }
  }

  async getImageStorageStats(): Promise<ImageStorageStats> {
    try {
      const response = await this.api.get<ImageStorageStats>('/api/classification/images/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch image storage statistics:', error);
      throw error;
    }
  }

  async cleanupOldImages(olderThanDays: number = 30, dryRun: boolean = true): Promise<{message: string}> {
    try {
      const response = await this.api.post<{message: string}>(
        '/api/classification/images/cleanup',
        null,
        { params: { olderThanDays, dryRun } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to cleanup old images:', error);
      throw error;
    }
  }

  // Search with image support
  async searchClassifications(criteria: SearchCriteria): Promise<PagedResult<ClassificationResult>> {
    try {
      const response = await this.api.get<PagedResult<ClassificationResult>>(
        '/api/classification/search',
        { params: criteria }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to search classifications:', error);
      throw error;
    }
  }

  // Override Management
  async overrideClassification(request: OverrideRequest): Promise<ClassificationResult> {
    try {
      const response = await this.api.post<ClassificationResult>(
        '/api/classification/override',
        request
      );
      return response.data;
    } catch (error) {
      console.error('Failed to override classification:', error);
      throw error;
    }
  }

  async getOverrideHistory(): Promise<ClassificationResult[]> {
    try {
      const response = await this.getClassifications({
        isOverridden: true,
        sortBy: 'overrideTimestamp',
        sortDescending: true,
        limit: 100
      });
      return response.items;
    } catch (error) {
      console.error('Failed to fetch override history:', error);
      throw error;
    }
  }

  async getClassificationWithImage(id: number): Promise<ClassificationResult | null> {
    try {
      const response: AxiosResponse<ClassificationResult> = 
        await this.api.get(`/api/classification/${id}/with-image`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Dashboard and Statistics
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Fetch multiple endpoints to compile dashboard stats
      const [classifications, systemStatus, imageStats] = await Promise.all([
        this.getClassifications({ limit: 100 }),
        this.getSystemStatus(),
        this.getImageStorageStats()
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const thisWeekStart = new Date();
      thisWeekStart.setDate(thisWeekStart.getDate() - 7);
      thisWeekStart.setHours(0, 0, 0, 0);

      const todayItems = classifications.items.filter(
        item => new Date(item.timestamp) >= today
      );
      
      const weekItems = classifications.items.filter(
        item => new Date(item.timestamp) >= thisWeekStart
      );

      const overriddenItems = classifications.items.filter(item => item.isOverridden);

      // Classification breakdown
      const classificationBreakdown: { [key: string]: number } = {};
      classifications.items.forEach(item => {
        classificationBreakdown[item.finalClassification] = 
          (classificationBreakdown[item.finalClassification] || 0) + 1;
      });

      // Hourly throughput (simplified)
      const hourlyThroughput: { [key: string]: number } = {};
      for (let hour = 0; hour < 24; hour++) {
        hourlyThroughput[`${hour}:00`] = Math.floor(Math.random() * 10); // Mock data
      }

      return {
        itemsToday: todayItems.length,
        itemsThisWeek: weekItems.length,
        overrideRate: classifications.items.length > 0 
          ? (overriddenItems.length / classifications.items.length) * 100 
          : 0,
        averageConfidence: classifications.items.length > 0
          ? classifications.items.reduce((sum, item) => sum + item.finalConfidence, 0) / classifications.items.length
          : 0,
        averageProcessingTime: classifications.items.length > 0
          ? classifications.items.reduce((sum, item) => sum + item.processingTimeMs, 0) / classifications.items.length
          : 0,
        classificationBreakdown,
        hourlyThroughput,
        systemStatus,
        recentAlerts: [], // Would be fetched from alerts endpoint
        
        // IMAGE STATISTICS
        imagesStoredToday: todayItems.filter(item => item.hasImage).length,
        totalImageStorageSize: imageStats.totalStorageSizeMB,
        averageImageSize: imageStats.averageImageSizeMB
      };
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      throw error;
    }
  }

  async getSystemStatus(): Promise<SystemStatus> {
    try {
      // Mock system status - in real implementation, this would be a dedicated endpoint
      return {
        isConnected: true,
        lastUpdate: new Date().toISOString(),
        cameraConnected: Math.random() > 0.1, // 90% chance connected
        cnnServiceHealthy: Math.random() > 0.05, // 95% chance healthy
        arduinoConnected: Math.random() > 0.15, // 85% chance connected
        expertSystemHealthy: Math.random() > 0.1, // 90% chance healthy
        itemsInQueue: Math.floor(Math.random() * 5),
        isProcessing: Math.random() > 0.7, // 30% chance processing
        imageStorageEnabled: true,
        additionalInfo: {
          version: '1.0.0',
          uptime: '2d 14h 32m'
        }
      };
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      throw error;
    }
  }

  async getClassificationStatistics(fromDate?: Date, toDate?: Date) {
    try {
      const params: any = {};
      if (fromDate) params.fromDate = fromDate.toISOString();
      if (toDate) params.toDate = toDate.toISOString();

      const response = await this.api.get('/api/classification/statistics', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch classification statistics:', error);
      throw error;
    }
  }

  // Utility method to check if image is available
  isImageAvailable(classification: ClassificationResult): boolean {
    return classification.hasImage && !!classification.imageBase64;
  }

  // Utility method to get image URL for display
  getImageUrl(classification: ClassificationResult): string | null {
    if (!this.isImageAvailable(classification)) {
      return null;
    }
    
    const format = classification.imageFormat || 'jpeg';
    return `data:image/${format};base64,${classification.imageBase64}`;
  }

  // Utility method to format image size
  formatImageSize(sizeBytes?: number): string {
    if (!sizeBytes) return 'Unknown';
    
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Health check endpoint
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.api.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const apiService = new APIService();
export default apiService;

// Export types for use in components
export type {
  ClassificationResult,
  DashboardStats,
  SystemStatus,
  OverrideRequest,
  SearchCriteria,
  PagedResult,
  ImageStorageStats
};
