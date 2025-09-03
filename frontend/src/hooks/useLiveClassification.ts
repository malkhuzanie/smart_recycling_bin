import { useState, useEffect, useCallback, useRef } from 'react';
import useSignalR from './useSignalR';
import apiService, { ClassificationResult, SystemStatus } from '../services/api';

// Types for live classification
interface LiveClassificationState {
  currentClassification: ClassificationResult | null;
  previousClassifications: ClassificationResult[];
  isProcessing: boolean;
  systemStatus: SystemStatus;
  error: string | null;
  lastUpdate: Date | null;
}

interface LiveClassificationActions {
  overrideClassification: (overrideData: any) => Promise<boolean>;
  approveClassification: (classificationId: number) => Promise<boolean>;
  rejectClassification: (classificationId: number, reason: string) => Promise<boolean>;
  requestReclassification: (detectionId: string) => Promise<boolean>;
  triggerManualCapture: () => Promise<boolean>;
  clearError: () => void;
  refreshCurrentClassification: () => Promise<void>;
}

interface ClassificationOverrideData {
  classificationId: number;
  newClassification: string;
  newDisposalLocation?: string;
  reason: string;
  processingTimeMs?: number;
}

const HISTORY_LIMIT = 10;
const CONNECTION_TIMEOUT = 30000; // 30 seconds

export const useLiveClassification = (): LiveClassificationState & LiveClassificationActions => {
  // State management
  const [currentClassification, setCurrentClassification] = useState<ClassificationResult | null>(null);
  const [previousClassifications, setPreviousClassifications] = useState<ClassificationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isConnected: false,
    lastUpdate: new Date().toISOString(),
    cameraConnected: false,
    cnnServiceHealthy: false,
    arduinoConnected: false,
    expertSystemHealthy: false,
    itemsInQueue: 0,
    isProcessing: false,
    imageStorageEnabled: false,
    additionalInfo: {},
  });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Refs for tracking processing state
  const currentProcessingRef = useRef<string | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SignalR connection
  const {
    isConnected: signalRConnected,
    lastMessage,
    sendMessage,
    error: signalRError,
    reconnect: signalRReconnect,
  } = useSignalR(
    `${process.env.REACT_APP_WS_URL}/hubs/classification`,
    {
      autoConnect: true,
      autoJoinGroup: 'Classification', // Auto-join Classification group
      reconnectAttempts: 5,
      reconnectInterval: 5000,
      onConnected: () => {
        console.log('Live classification SignalR connected');
        setError(null);
        // Load initial data after connection
        setTimeout(() => {
          loadInitialData();
        }, 1000);
      },
      onDisconnected: (error) => {
        console.log('Live classification SignalR disconnected:', error?.message);
        setError(error?.message || 'Connection lost');
        setIsProcessing(false);
      },
      onError: (error) => {
        console.error('Live classification SignalR error:', error);
        setError(error.message);
        setIsProcessing(false);
      },
    }
  );

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      // Get latest classification
      const searchResult = await apiService.getClassifications({
        limit: 1,
        sortBy: 'timestamp',
        sortDescending: true
      });
      
      if (searchResult.items.length > 0) {
        setCurrentClassification(searchResult.items[0]);
      }

      // Get system status
      const status = await apiService.getSystemStatus();
      setSystemStatus(status);
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading initial live classification data:', error);
      setError('Failed to load classification data');
    }
  }, []);

  // Handle SignalR messages
  useEffect(() => {
    const handleNewClassification = async (data: any) => {
      console.log('New classification result received via SignalR:', data);

      // If the new result has an image, we need to fetch the full object
      // because the broadcast message only contains metadata.
      if (data.hasImage && data.id) {
        try {
          console.log(`Image detected for classification ${data.id}. Fetching full data...`);
          const fullClassificationData = await apiService.getClassificationWithImage(data.id);
          
          if (fullClassificationData) {
            console.log("Full classification data with image fetched:", fullClassificationData);
            // Move the OLD current classification to the previous list
            if (currentClassification) {
              setPreviousClassifications(prev => {
                const newPrevious = [currentClassification, ...prev];
                return newPrevious.slice(0, HISTORY_LIMIT - 1);
              });
            }
            // Set the NEW, complete classification data as current
            setCurrentClassification(fullClassificationData);
          } else {
            // Fallback if the fetch fails
            setCurrentClassification(data);
          }
        } catch (error) {
          console.error("Failed to fetch full classification with image:", error);
          // Set the partial data as a fallback
          setCurrentClassification(data);
        }
      } else {
        // No image, just update state directly
        if (currentClassification) {
          setPreviousClassifications(prev => {
            const newPrevious = [currentClassification, ...prev];
            return newPrevious.slice(0, HISTORY_LIMIT - 1);
          });
        }
        setCurrentClassification(data);
      }

      setIsProcessing(false);
      
      // Clear processing timeout
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      
      currentProcessingRef.current = null;
    };

    if (!lastMessage) return;

    const { type, data } = lastMessage;
    setLastUpdate(new Date());

    switch (type) {
      case 'classification_result':
        console.log('New classification result:', data);
        handleNewClassification(data);
        console.error("pref", currentProcessingRef);
        break;

      case 'processing_status':
        console.log('Processing status update:', data);
        
        if (data.status === 'started' || data.status === 'processing') {
          setIsProcessing(true);
          currentProcessingRef.current = data.detectionId || data.id;
          
          // Set processing timeout
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
          }
          
          processingTimeoutRef.current = setTimeout(() => {
            console.warn('Processing timeout exceeded');
            setIsProcessing(false);
            setError('Classification processing timeout');
            currentProcessingRef.current = null;
          }, CONNECTION_TIMEOUT);
          
        } else if (data.status === 'completed' || data.status === 'failed') {
          setIsProcessing(false);
          currentProcessingRef.current = null;
          
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
            processingTimeoutRef.current = null;
          }
          
          if (data.status === 'failed') {
            setError(data.error || 'Classification processing failed');
          }
        }
        
        // Update system status if provided
        if (data.systemStatus) {
          setSystemStatus(prev => ({ ...prev, ...data.systemStatus }));
        }
        break;

      case 'system_status':
        console.log('System status update:', data);
        setSystemStatus(prev => ({ ...prev, ...data }));
        break;

      case 'classification_overridden':
        console.log('Classification overridden:', data);
        
        // Update current classification if it matches
        if (currentClassification && currentClassification.id === data.classificationId) {
          setCurrentClassification(prev => prev ? {
            ...prev,
            isOverridden: true,
            overrideReason: data.reason,
            overrideClassification: data.newClassification,
            disposalLocation: data.newDisposalLocation || prev.disposalLocation
          } : prev);
        }
        
        // Update in previous classifications
        setPreviousClassifications(prev => 
          prev.map(item => 
            item.id === data.classificationId 
              ? {
                  ...item,
                  isOverridden: true,
                  overrideReason: data.reason,
                  overrideClassification: data.newClassification,
                  disposalLocation: data.newDisposalLocation || item.disposalLocation
                }
              : item
          )
        );
        break;

      case 'error':
        console.error('Live classification error:', data);
        setError(data.message || 'An error occurred');
        setIsProcessing(false);
        break;

      default:
        console.log('Unhandled live classification message:', type, data);
    }
  }, [lastMessage, currentClassification]);

  // Actions
  const overrideClassification = useCallback(async (overrideData: ClassificationOverrideData): Promise<boolean> => {
    if (!signalRConnected) {
      console.warn('Cannot override classification: not connected');
      setError('Not connected to classification service');
      return false;
    }

    try {
      const success = await sendMessage('ApplyManualOverride', JSON.stringify(overrideData));
      if (!success) {
        setError('Failed to apply override');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error applying override:', error);
      setError('Failed to apply classification override');
      return false;
    }
  }, [signalRConnected, sendMessage]);

  const approveClassification = useCallback(async (classificationId: number): Promise<boolean> => {
    if (!signalRConnected) {
      setError('Not connected to classification service');
      return false;
    }

    try {
      const success = await sendMessage('ApproveClassification', classificationId);
      if (!success) {
        setError('Failed to approve classification');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error approving classification:', error);
      setError('Failed to approve classification');
      return false;
    }
  }, [signalRConnected, sendMessage]);

  const rejectClassification = useCallback(async (classificationId: number, reason: string): Promise<boolean> => {
    if (!signalRConnected) {
      setError('Not connected to classification service');
      return false;
    }

    try {
      const success = await sendMessage('RejectClassification', classificationId, reason);
      if (!success) {
        setError('Failed to reject classification');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error rejecting classification:', error);
      setError('Failed to reject classification');
      return false;
    }
  }, [signalRConnected, sendMessage]);

  const requestReclassification = useCallback(async (detectionId: string): Promise<boolean> => {
    if (!signalRConnected) {
      setError('Not connected to classification service');
      return false;
    }

    try {
      const success = await sendMessage('RequestReclassification', detectionId);
      if (!success) {
        setError('Failed to request reclassification');
        return false;
      }
      
      setIsProcessing(true);
      return true;
    } catch (error) {
      console.error('Error requesting reclassification:', error);
      setError('Failed to request reclassification');
      return false;
    }
  }, [signalRConnected, sendMessage]);

  const triggerManualCapture = useCallback(async (): Promise<boolean> => {
    if (!signalRConnected) {
      setError('Not connected to classification service');
      return false;
    }

    try {
      const success = await sendMessage('TriggerManualCapture');
      if (!success) {
        setError('Failed to trigger manual capture');
        return false;
      }
      
      setIsProcessing(true);
      return true;
    } catch (error) {
      console.error('Error triggering manual capture:', error);
      setError('Failed to trigger manual capture');
      return false;
    }
  }, [signalRConnected, sendMessage]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshCurrentClassification = useCallback(async (): Promise<void> => {
    try {
      const searchResult = await apiService.getClassifications({
        limit: 1,
        sortBy: 'timestamp',
        sortDescending: true
      });
      
      if (searchResult.items.length > 0) {
        setCurrentClassification(searchResult.items[0]);
      }
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error refreshing current classification:', error);
      setError('Failed to refresh classification data');
    }
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }
    };
  }, []);

  // Update system connection status
  useEffect(() => {
    setSystemStatus(prev => ({
      ...prev,
      isConnected: signalRConnected
    }));
  }, [signalRConnected]);

  // Combine errors
  const combinedError = error || signalRError;

  return {
    // State
    currentClassification,
    previousClassifications,
    isProcessing,
    systemStatus,
    error: combinedError,
    lastUpdate,

    // Actions
    overrideClassification,
    approveClassification,
    rejectClassification,
    requestReclassification,
    triggerManualCapture,
    clearError,
    refreshCurrentClassification,
  };
};
