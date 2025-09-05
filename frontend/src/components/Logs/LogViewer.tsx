import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Paper, LinearProgress } from '@mui/material';
import useSignalR from '../../hooks/useSignalR';
import apiService from '../../services/api';

interface LogViewerProps {
  logFileName: string;
  serviceName: string;
}

const LogViewer: React.FC<LogViewerProps> = ({ logFileName, serviceName }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Hook for live log streaming
  const { lastMessage: newLogLine, isConnected } = useSignalR(
    `${process.env.REACT_APP_WS_URL}/hubs/logs`,
    {
      autoConnect: true,
      autoJoinGroup: serviceName, // Auto-join the group for this service's logs
    }
  );

  // Fetch initial historical logs
  useEffect(() => {
    const fetchInitialLogs = async () => {
      setLoading(true);
      try {
        const initialLogs = await apiService.getLogFile(logFileName, 500);
        setLogs(initialLogs);
      } catch (error) {
        setLogs([`Error fetching logs: ${error}`]);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialLogs();
  }, [logFileName]);

  // Append new log lines from SignalR
  useEffect(() => {
    if (newLogLine && newLogLine.type === 'ReceiveLogLine') {
      const [receivedServiceName, logLine] = newLogLine.data;
      if (receivedServiceName === serviceName) {
        setLogs(prevLogs => [...prevLogs, logLine]);
      }
    }
  }, [newLogLine, serviceName]);

  // Auto-scroll to the bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="caption" color={isConnected ? 'success.main' : 'error.main'}>
        Real-time stream: {isConnected ? 'Connected' : 'Disconnected'}
      </Typography>
      {loading && <LinearProgress sx={{ my: 1 }} />}
      <Paper
        ref={logContainerRef}
        variant="outlined"
        sx={{
          mt: 1,
          height: '60vh',
          overflow: 'auto',
          p: 2,
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {logs.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
      </Paper>
    </Box>
  );
};

export default LogViewer;

