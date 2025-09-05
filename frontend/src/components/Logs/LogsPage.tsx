import React from 'react';
import { Box, Paper, Typography, Tabs, Tab } from '@mui/material';
import LogViewer from './LogViewer';

const LogsPage: React.FC = () => {
  const [tabIndex, setTabIndex] = React.useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Service Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View historical and real-time logs from backend services.
        </Typography>
      </Paper>
      
      <Paper>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Python Orchestrator" />
          <Tab label="C# Backend" />
        </Tabs>
        
        {/* Python Log Viewer */}
        {tabIndex === 0 && (
          <LogViewer
            logFileName="orchestrated_services.log"
            serviceName="python-services" 
          />
        )}
        
        {/* Backend Log Viewer */}
        {tabIndex === 1 && (
           <LogViewer
            // The LogService on the backend is smart enough to find the latest
            // file if we just provide the prefix.
            logFileName="smart-recycling-bin.log"
            // This MUST match the 'ServiceName' constant in SignalRLogger.cs
            serviceName="csharp-backend"
          />
        )}
      </Paper>
    </Box>
  );
};

export default LogsPage;

