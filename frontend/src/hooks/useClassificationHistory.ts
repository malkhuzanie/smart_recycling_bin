import { useState, useEffect, useCallback } from 'react';
import useSignalR from './useSignalR';
import apiService, { ClassificationResult, SearchCriteria, PagedResult } from '../services/api';

interface ClassificationHistoryHook {
  // Data
  classifications: ClassificationResult[];
  latestClassification: ClassificationResult | null;
  totalCount: number;
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  
  // Actions
  fetchClassifications: (criteria?: SearchCriteria) => Promise<void>;
  refreshData: () => Promise<void>;
  changePage: (page: number) => Promise<void>;
  clearError: () => void;
}

export const useClassificationHistory = (): ClassificationHistoryHook => {
  // State management
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [latestClassification, setLatestClassification] = useState<ClassificationResult | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  
  // Current search criteria
  const [currentCriteria, setCurrentCriteria] = useState<SearchCriteria>({
    limit: 50,
    offset: 0,
    sortBy: 'timestamp',
    sortDescending: true,
  });

  // SignalR connection for real-time updates
  const {
    isConnected,
    lastMessage,
    error: signalRError,
  } = useSignalR(
    `${process.env.REACT_APP_WS_URL}/hubs/classification`,
    {
      autoConnect: true,
      autoJoinGroup: 'Classification', // Auto-join Classification group for updates
      reconnectAttempts: 3,
      reconnectInterval: 5000,
      onConnected: () => {
        console.log('Classification History SignalR connected');
        setHistoryError(null);
      },
      onDisconnected: (error) => {
        console.log('Classification History SignalR disconnected:', error?.message);
      },
      onError: (error) => {
        console.error('Classification History SignalR error:', error);
        setHistoryError(error.message);
      },
    }
  );

  // Handle real-time updates from SignalR
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'classification_result':
        console.log('New classification received in history:', data);
        
        // Update latest classification
        setLatestClassification(data);
        
        // If we're on the first page with recent results, add to the list
        if (currentPage === 1 && currentCriteria.sortDescending && currentCriteria.sortBy === 'timestamp') {
          setClassifications(prev => {
            // Check if this classification already exists (avoid duplicates)
            const exists = prev.some(item => item.id === data.id || item.detectionId === data.detectionId);
            if (!exists) {
              const newList = [data, ...prev];
              // Keep within the limit
              const limit = currentCriteria.limit || 50;
              return newList.slice(0, limit);
            }
            return prev;
          });
          
          // Update total count
          setTotalCount(prev => prev + 1);
          
          // Update pagination info
          updatePaginationInfo(totalCount + 1, currentCriteria.limit || 50);
        }
        break;
      
      case 'classification_overridden':
        console.log('Classification overridden in history:', data);
        
        // Update classification in the list if it exists
        setClassifications(prev => prev.map(item => 
          item.id === data.classificationId 
            ? {
                ...item,
                isOverridden: true,
                overrideReason: data.reason,
                overrideClassification: data.newClassification,
                disposalLocation: data.newDisposalLocation || item.disposalLocation
              }
            : item
        ));
        
        // Update latest classification if it matches
        if (latestClassification && latestClassification.id === data.classificationId) {
          setLatestClassification(prev => prev ? {
            ...prev,
            isOverridden: true,
            overrideReason: data.reason,
            overrideClassification: data.newClassification,
            disposalLocation: data.newDisposalLocation || prev.disposalLocation
          } : prev);
        }
        break;
      
      case 'error':
        console.error('Classification history SignalR error:', data);
        setHistoryError(data.message || 'Real-time update error');
        break;

      default:
        // Ignore other message types for history
        break;
    }
  }, [lastMessage, currentPage, currentCriteria, totalCount, latestClassification]);

  // Helper function to update pagination info
  const updatePaginationInfo = useCallback((total: number, limit: number) => {
    const pages = Math.ceil(total / limit);
    setTotalPages(pages);
    setHasNextPage(currentPage < pages);
    setHasPreviousPage(currentPage > 1);
  }, [currentPage]);

  // Fetch classifications from API
  const fetchClassifications = useCallback(async (criteria: SearchCriteria = currentCriteria): Promise<void> => {
    if (loading) return;

    setLoading(true);
    setHistoryError(null);

    try {
      const result: PagedResult<ClassificationResult> = await apiService.getClassifications(criteria);
      
      setClassifications(result.items);
      setTotalCount(result.totalCount);
      setCurrentCriteria(criteria);
      
      // Update latest classification if we're getting recent data
      if (result.items.length > 0 && criteria.sortDescending && criteria.sortBy === 'timestamp') {
        setLatestClassification(result.items[0]);
      }
      
      // Calculate pagination
      const limit = criteria.limit || 50;
      const offset = criteria.offset || 0;
      const page = Math.floor(offset / limit) + 1;
      
      setCurrentPage(page);
      updatePaginationInfo(result.totalCount, limit);
      
    } catch (error) {
      console.error('Error fetching classifications:', error);
      setHistoryError('Failed to fetch classification history');
      setClassifications([]);
      setTotalCount(0);
      setTotalPages(0);
      setHasNextPage(false);
      setHasPreviousPage(false);
    } finally {
      setLoading(false);
    }
  }, [currentCriteria, loading, updatePaginationInfo]);

  // Refresh current data
  const refreshData = useCallback(async (): Promise<void> => {
    await fetchClassifications(currentCriteria);
  }, [fetchClassifications, currentCriteria]);

  // Change page
  const changePage = useCallback(async (page: number): Promise<void> => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    const limit = currentCriteria.limit || 50;
    const offset = (page - 1) * limit;

    const newCriteria: SearchCriteria = {
      ...currentCriteria,
      offset,
    };

    await fetchClassifications(newCriteria);
  }, [totalPages, currentPage, currentCriteria, fetchClassifications]);

  // Clear error
  const clearError = useCallback(() => {
    setHistoryError(null);
  }, []);

  // Load initial data
  useEffect(() => {
    if (!loading && classifications.length === 0) {
      fetchClassifications();
    }
  }, []);

  // Combine errors
  const combinedError = historyError || signalRError;

  return {
    // Data
    classifications,
    latestClassification,
    totalCount,
    loading,
    error: combinedError,
    
    // Pagination
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    
    // Actions
    fetchClassifications,
    refreshData,
    changePage,
    clearError,
  };
};
