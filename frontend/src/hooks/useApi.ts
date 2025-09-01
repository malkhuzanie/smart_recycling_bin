import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useApi = <T>(
  apiCall: () => Promise<T>,
  dependencies: React.DependencyList = []
) => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await apiCall();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
  };
};

export const useDashboardStats = (refreshInterval = 30000) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const result = useApi(
    () => api.getDashboardStats(),
    [refreshTrigger]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return result;
};
