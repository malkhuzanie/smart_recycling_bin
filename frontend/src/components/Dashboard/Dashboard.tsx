import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  TrendingUp,
  Assessment,
  Speed,
  Security,
} from '@mui/icons-material';
import { useSignalR } from '../../hooks/useSignalR';

const Dashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  const {
    connected,
    isConnected,
    isLoading,
    error,
    stats,
    health,
    latestClassification,
    latestAlert,
    reconnect,
    requestSystemStatus,
    requestStats,
  } = useSignalR();

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([requestSystemStatus(), requestStats()]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle reconnect
  const handleReconnect = async () => {
    setRefreshing(true);
    try {
      await reconnect();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Utility functions
  const formatPercentage = (value: number | undefined) => {
    return `${((value || 0) * 100).toFixed(1)}%`;
  };

  const formatNumber = (value: number | undefined) => {
    return (value || 0).toLocaleString();
  };

  const formatDate = (value: Date | string | undefined) => {
    if (!value) return 'Never';
    const date = typeof value === 'string' ? new Date(value) : value;
    return date.toLocaleString();
  };

  const getStatusColor = (isConnected: boolean) => {
    return isConnected ? 'success' : 'error';
  };

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Smart Recycling Bin Dashboard
        </Typography>
        <LinearProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Connecting to system...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
              Smart Recycling Control Center
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Real-time Monitoring & Classification System
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <Chip
              label={isConnected ? 'System Online' : 'System Offline'}
              color={getStatusColor(isConnected)}
              variant="outlined"
            />
            <Tooltip title="Refresh Data">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {!isConnected && (
              <Button 
                variant="outlined" 
                color="error" 
                onClick={handleReconnect}
                disabled={refreshing}
              >
                Reconnect
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* System Status */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          System Components Status
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Classification Hub
                </Typography>
                <Chip
                  label={connected.classification ? 'Connected' : 'Disconnected'}
                  color={getStatusColor(connected.classification)}
                  icon={connected.classification ? <CheckCircleIcon /> : <ErrorIcon />}
                  variant="outlined"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Dashboard Hub
                </Typography>
                <Chip
                  label={connected.dashboard ? 'Connected' : 'Disconnected'}
                  color={getStatusColor(connected.dashboard)}
                  icon={connected.dashboard ? <CheckCircleIcon /> : <ErrorIcon />}
                  variant="outlined"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  CNN Service
                </Typography>
                <Chip
                  label={health.CnnServiceHealthy ? 'Healthy' : 'Issues Detected'}
                  color={getStatusColor(health.CnnServiceHealthy)}
                  icon={health.CnnServiceHealthy ? <CheckCircleIcon /> : <WarningIcon />}
                  variant="outlined"
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography color="text.secondary" gutterBottom>
                  Sensor Array
                </Typography>
                <Chip
                  label={health.ArduinoConnected ? 'Connected' : 'Disconnected'}
                  color={getStatusColor(health.ArduinoConnected)}
                  icon={health.ArduinoConnected ? <CheckCircleIcon /> : <ErrorIcon />}
                  variant="outlined"
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      {/* Key Performance Metrics */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Performance Metrics
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Items Today
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {formatNumber(stats.ItemsToday)}
                    </Typography>
                  </Box>
                  <TrendingUp color="primary" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Accuracy Rate
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {formatPercentage(stats.AccuracyRate)}
                    </Typography>
                  </Box>
                  <Assessment color="success" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Processing Time
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {health.AvgProcessingTimeMs}ms
                    </Typography>
                  </Box>
                  <Speed color="warning" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Override Rate
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {stats.OverrideRate.toFixed(1)}%
                    </Typography>
                  </Box>
                  <Security color="info" sx={{ fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Latest Classification */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3, backgroundColor: 'white' }} elevation={1}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Latest Classification Result
            </Typography>
            {latestClassification ? (
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Classification</TableCell>
                      <TableCell>{latestClassification.finalClassification}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Confidence</TableCell>
                      <TableCell>{formatPercentage(latestClassification.finalConfidence)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Processing Time</TableCell>
                      <TableCell>{latestClassification.processingTime}ms</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Disposal Location</TableCell>
                      <TableCell>{latestClassification.disposalLocation}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Item ID</TableCell>
                      <TableCell>#{latestClassification.id}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <Typography variant="body1">
                  Waiting for classification data...
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  The system is ready to process incoming items
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* System Summary */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 3, backgroundColor: 'white' }} elevation={1}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              System Summary
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Items Processed
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {formatNumber(stats.TotalItems)}
                </Typography>
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Weekly Progress
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {formatNumber(stats.ItemsThisWeek)} items
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={85} 
                  sx={{ 
                    mt: 1,
                    height: 8
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  85% of weekly target
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  System Uptime
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {health.SystemUptime.toFixed(1)} hours
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Memory Usage
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {(health.MemoryUsageMB / 1024).toFixed(1)} GB
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Classification Breakdown */}
      <Paper sx={{ p: 3, mt: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Today's Classification Breakdown
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Material Type</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Percentage</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(stats.ClassificationBreakdown || {}).map(([category, count]) => {
                const percentage = (count / stats.ItemsToday) * 100;
                return (
                  <TableRow key={category}>
                    <TableCell>{category}</TableCell>
                    <TableCell align="right">{formatNumber(count)}</TableCell>
                    <TableCell align="right">{percentage.toFixed(1)}%</TableCell>
                    <TableCell>
                      <Box sx={{ width: '100%', maxWidth: 200 }}>
                        <LinearProgress 
                          variant="determinate" 
                          value={Math.min(percentage, 100)} 
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

      {/* Alert Display */}
      {latestAlert && (
        <Alert
          severity={latestAlert.level as 'error' | 'warning' | 'info'}
          sx={{ mt: 3 }}
        >
          <Typography variant="subtitle2">
            {latestAlert.source} - {formatDate(latestAlert.timestamp)}
          </Typography>
          <Typography variant="body2">{latestAlert.message}</Typography>
        </Alert>
      )}
    </Box>
  );
};

export default Dashboard;
