import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api'; 

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

function useApi<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = [],
  immediate: boolean = true
): UseApiReturn<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await apiCall();
      setState({
        data: result,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  }, [apiCall]);

  const refresh = useCallback(async () => {
    await execute();
  }, [execute]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, dependencies);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    refresh,
    clearError,
  };
}

export default useApi;
