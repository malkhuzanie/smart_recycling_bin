// frontend/src/types/index.ts

// Classification related types - Unified interface for all uses
export interface ClassificationResult {
  id: number;
  timestamp: string | Date;
  finalClassification: string;
  finalConfidence: number;
  disposalLocation: string;
  processingTime: number;
  isOverridden: boolean;
  validationResults?: { [key: string]: any };
  overrideReason?: string;
  overriddenBy?: string;
  overrideClassification?: string;
  overrideTimestamp?: string | Date;
  
  // Additional properties from your backend model
  cnnPredictedClass?: string;
  cnnConfidence?: number;
  cnnStage?: number;
  processingTimeMs?: number;
  weightGrams?: number;
  isMetalDetected?: boolean;
  humidityPercent?: number;
  temperatureCelsius?: number;
  isMoist?: boolean;
  isTransparent?: boolean;
  isFlexible?: boolean;
  reasoning?: string;
  candidatesCount?: number;
  
  // Properties expected by ClassificationHistory component
  cnnStage1Class?: string;
  cnnStage1Confidence?: number;
  cnnStage2Class?: string;
  cnnStage2Confidence?: number;
  sensorValidation?: SensorValidationResult;
  decisionPath?: string;
  imageUrl?: string;
  overrideInfo?: ManualOverrideInfo;
}

export interface SensorValidationResult {
  weight: 'pass' | 'fail';
  metal: 'pass' | 'fail';
  humidity: 'pass' | 'fail';
  ir_spectroscopy: 'pass' | 'fail';
}

export interface ManualOverrideInfo {
  isOverridden: boolean;
  originalClassification?: string;
  reason?: string;
  overriddenBy?: string;
  overrideTimestamp?: string;
}

export interface ClassificationRequest {
  imageData?: string;
  sensorData?: SensorData;
  timestamp: string;
  triggeredBy: 'sensor' | 'manual' | 'system';
}

export interface SensorData {
  weightGrams: number;
  isMetalDetected: boolean;
  humidityPercent: number;
  temperatureCelsius: number;
  isMoist: boolean;
  isTransparent: boolean;
  isFlexible: boolean;
  irTransparency: number;
}

export interface IRSpectroscopyData {
  wavelengths: number[];
  absorption: number[];
  detectedMaterials: string[];
  confidence: number;
}

// Hub communication types
export interface ClassificationTriggeredMessage {
  triggeredBy: 'sensor' | 'manual';
  sensorData?: SensorData;
  timestamp: string;
}

export interface SystemAlert {
  level: 'info' | 'warning' | 'error';
  severity?: string;
  message: string;
  timestamp: string;
  source: string;
  component?: string;
}

export interface DashboardUpdate {
  type: 'stats' | 'status' | 'alert' | 'initial_status' | 'recent_classifications' | 'classification';
  data: any;
  timestamp: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// System statistics types - Using ACTUAL backend model names
export interface SystemStats {
  totalItems: number;
  accuracyRate: number;
  avgProcessingTime: number;
  classificationBreakdown: { [key: string]: number };
  overrideRate: number;
  itemsToday: number;
  itemsThisWeek: number;
  itemsThisMonth: number;
  lastClassification: Date | string;
  hourlyBreakdown: HourlyStats[];
}

export interface HourlyStats {
  hour: Date | string;
  count: number;
  avgAccuracy: number;
}

export interface DashboardStats {
  totalItemsProcessed: number;
  currentAccuracy: number;
  averageProcessingTime: number;
  systemHealth: number;
  todayStats: {
    itemsProcessed: number;
    accuracy: number;
    avgProcessingTime: number;
  };
  materialDistribution: {
    [key: string]: number;
  };
  recentPerformance: PerformanceMetric[];
  classificationTrends: ClassificationTrend[];
}

export interface PerformanceMetric {
  timestamp: string;
  accuracy: number;
  throughput: number;
  confidence: number;
  processingTime: number;
}

export interface ClassificationTrend {
  date: string;
  plastic: number;
  metal: number;
  glass: number;
  paper: number;
  organic: number;
}

// System health types - Using camelCase to match API response
export interface SystemHealth {
  timestamp: Date | string;
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
  isHealthy?: boolean; // Computed property for UI
}

// EXPORTED for api.ts
export interface SystemStatus {
  isOnline: boolean;
  lastUpdate: string;
  cameraConnected: boolean;
  arduinoConnected: boolean;
  cnnServiceHealthy: boolean;
  expertSystemHealthy: boolean;
  systemUptime: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  alerts: SystemAlert[];
}

export interface ServiceStatus {
  name: string;
  isRunning: boolean;
  lastPing: Date | string;
  responseTime: number;
  errorCount: number;
}

// Manual override types
export interface ManualOverrideRequest {
  classificationId: number;
  newClassification: string;
  newDisposalLocation?: string;
  reason: string;
  userId?: string;
  timestamp: string;
}

// Waste classification types
export enum WasteCategory {
  METAL = 'metal',
  PLASTIC = 'plastic',
  GLASS = 'glass',
  PAPER = 'paper',
  CARDBOARD = 'cardboard',
  ORGANIC = 'organic',
  ELECTRONIC = 'electronic',
  HAZARDOUS = 'hazardous',
  UNKNOWN = 'unknown'
}

export enum PlasticType {
  PET = 'PET',
  HDPE = 'HDPE',
  PVC = 'PVC',
  LDPE = 'LDPE',
  PP = 'PP',
  PS = 'PS',
  OTHER = 'OTHER'
}

export interface WasteItem {
  id: string;
  category: WasteCategory;
  subtype?: string;
  confidence: number;
  weight?: number;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };
  imageUrl?: string;
  detectedAt: Date;
  processedAt?: Date;
  disposalBin?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// Alternative naming that might be used
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ClassificationSearchCriteria {
  fromDate?: Date;
  toDate?: Date;
  classifications?: string[];
  minConfidence?: number;
  maxConfidence?: number;
  decisionPath?: string;
  hasOverride?: boolean;
  limit?: number;
  // Backend might expect PascalCase
  FromDate?: Date;
  ToDate?: Date;
  Limit?: number;
}

// Configuration types
export interface SystemConfiguration {
  confidenceThreshold: number;
  processingTimeout: number;
  enableManualOverride: boolean;
  autoSort: boolean;
  cameraSettings: CameraSettings;
  sensorSettings: SensorSettings;
}

export interface CameraSettings {
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  brightness: number;
  contrast: number;
  exposure: number;
}

export interface SensorSettings {
  weightSensitivity: number;
  metalDetectorSensitivity: number;
  humiditySensitivity: number;
  temperatureRange: {
    min: number;
    max: number;
  };
}

// UI state types
export interface ConnectionState {
  classification: boolean;
  dashboard: boolean;
  isConnecting: boolean;
  lastConnectionTime?: Date;
  reconnectAttempts: number;
}

export interface LoadingState {
  isLoading: boolean;
  operation?: string;
  progress?: number;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  code?: string;
  details?: any;
}

// Chart data types
export interface ChartDataPoint {
  label: string;
  value: number;
  timestamp?: Date;
  category?: string;
}

export interface TimeSeriesData {
  timestamp: Date;
  [metric: string]: number | Date;
}
