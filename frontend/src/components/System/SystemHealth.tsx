import React, { useState } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  AlertTitle,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Stack,
} from '@mui/material';
import {
  MonitorHeart,
  Camera,
  Memory,
  NetworkCheck,
  Sensors,
  SmartToy,
  CheckCircle,
  Warning,
  Error,
  Info,
  Refresh,
  Computer,
  Speed,
  Storage,
} from '@mui/icons-material';
import { useSystemHealth } from '../../hooks/useSystemHealth';

const SystemHealth: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  const {
    health,
    alerts,
    loading,
    error,
    isConnected,
    healthSummary,
    refresh,
    resolveAlert,
  } = useSystemHealth();

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle alert resolution
  const handleResolveAlert = async (alertId: number) => {
    await resolveAlert(alertId);
  };

  const getStatusColor = (isHealthy: boolean) => {
    return isHealthy ? 'success' : 'error';
  };

  const getStatusIcon = (isHealthy: boolean) => {
    return isHealthy ? <CheckCircle /> : <Error />;
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  if (loading && !health) {
    return (
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Typography variant="h4" gutterBottom>
          System Health Monitor
        </Typography>
        <LinearProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading system health data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 0, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <MonitorHeart sx={{ mr: 2, fontSize: '2rem', color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                System Health Monitor
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Real-time component status and system diagnostics
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>
      </Paper>

      {/* Connection Status Alert */}
      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Connection Issues</AlertTitle>
          Real-time updates may be limited. Check network connectivity.
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {/* System Overview */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          System Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 600 }}>
                {healthSummary?.healthyComponents ?? '...'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Healthy Components
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h3" color="warning.main" sx={{ fontWeight: 600 }}>
                {healthSummary?.warningComponents ?? '...'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Warnings
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
              <Typography variant="h3" color="error.main" sx={{ fontWeight: 600 }}>
                {healthSummary?.errorComponents ?? '...'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Critical Issues
              </Typography>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Active System Alerts ({alerts.length})
          </Typography>
          <Stack spacing={2}>
            {alerts.slice(0, 5).map((alert) => (
              <Alert
                key={alert.id}
                severity={getAlertSeverityColor(alert.severity) as any}
                action={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleResolveAlert(alert.id)}
                  >
                    Resolve
                  </Button>
                }
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  {alert.component} - {new Date(alert.timestamp).toLocaleString()}
                </Typography>
                <Typography variant="body2">{alert.message}</Typography>
              </Alert>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Component Health Status */}
      {health && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Component Health Status
          </Typography>
          <Grid container spacing={3}>
            {[
              {
                name: 'CNN Service',
                healthy: health.cnnServiceHealthy,
                icon: <SmartToy />,
                details: {
                  'Service Status': health.cnnServiceHealthy ? 'Running' : 'Offline',
                  'Processing Speed': `${health.avgProcessingTimeMs.toFixed(0)}ms`,
                  'Items Processed': health.totalItemsProcessed.toString(),
                  'Accuracy Rate': `${(health.accuracyRate * 100).toFixed(1)}%`,
                }
              },
              {
                name: 'Expert System',
                healthy: health.expertSystemHealthy,
                icon: <SmartToy />,
                details: {
                  'System Status': health.expertSystemHealthy ? 'Active' : 'Inactive',
                  'Integration': health.expertSystemHealthy ? 'Connected' : 'Disconnected',
                  'Last Update': new Date(health.timestamp).toLocaleString(),
                }
              },
              {
                name: 'Camera System',
                healthy: health.cameraConnected,
                icon: <Camera />,
                details: {
                  'Connection': health.cameraConnected ? 'Connected' : 'Disconnected',
                  'Status': health.cameraConnected ? 'Operational' : 'No Signal',
                }
              },
              {
                name: 'Sensor Array',
                healthy: health.arduinoConnected,
                icon: <Sensors />,
                details: {
                  'Connection': health.arduinoConnected ? 'Connected' : 'Disconnected',
                  'Status': health.arduinoConnected ? 'All sensors active' : 'No data',
                }
              },
            ].map((component, index) => (
              <Grid size={{ xs: 12, md: 6 }} key={index}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ mr: 2, color: 'primary.main' }}>
                          {component.icon}
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {component.name}
                        </Typography>
                      </Box>
                      <Chip
                        label={component.healthy ? 'Healthy' : 'Issues'}
                        color={getStatusColor(component.healthy)}
                        icon={getStatusIcon(component.healthy)}
                        variant="outlined"
                      />
                    </Box>
                    
                    <Table size="small">
                      <TableBody>
                        {Object.entries(component.details).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell sx={{ fontWeight: 600, border: 'none', py: 0.5 }}>
                              {key}
                            </TableCell>
                            <TableCell sx={{ border: 'none', py: 0.5 }}>
                              {value}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}

      {health?.additionalInfo && (
        <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            System Details
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableBody>
                {Object.entries(health.additionalInfo).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </TableCell>
                    <TableCell>{String(value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Performance Summary */}
      {health && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Performance Summary
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
                    <Computer color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {health.systemUptime.toFixed(1)}h
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    System Uptime
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
                    <Speed color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {health.avgProcessingTimeMs.toFixed(0)}ms
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Avg Response Time
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
                    <CheckCircle color="success" sx={{ mr: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {(health.accuracyRate * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Classification Accuracy
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
                    <Info color="info" sx={{ mr: 1 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {health.totalItemsProcessed.toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Total Items Processed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* System Resource Usage */}
      {health && (
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            System Resource Usage
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Memory sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Memory Usage
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                    {(health.memoryUsageMB / 1024).toFixed(1)} GB
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min((health.memoryUsageMB / 16384) * 100, 100)} // Assuming 16GB max
                    sx={{ mb: 1, height: 8 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {health.memoryUsageMB.toFixed(0)} MB used of available memory
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Storage sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      CPU Usage
                    </Typography>
                  </Box>
                  <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                    {health.cpuUsagePercent.toFixed(1)}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.min(health.cpuUsagePercent, 100)}
                    sx={{ mb: 1, height: 8 }}
                    color={health.cpuUsagePercent > 80 ? 'error' : 'primary'}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Current CPU utilization
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Classification Counts */}
      {health && Object.keys(health.classificationCounts).length > 0 && (
        <Paper sx={{ p: 3, backgroundColor: 'white' }} elevation={1}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Recent Classification Activity
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Material Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Activity</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(health.classificationCounts).map(([category, count]) => {
                  const total = Object.values(health.classificationCounts).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  
                  return (
                    <TableRow key={category}>
                      <TableCell>{category}</TableCell>
                      <TableCell align="right">{count.toLocaleString()}</TableCell>
                      <TableCell>
                        <Box sx={{ width: '100%', maxWidth: 200 }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={percentage} 
                            sx={{ height: 6 }}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default SystemHealth;
