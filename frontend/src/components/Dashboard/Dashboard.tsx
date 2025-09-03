import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  Assessment,
  Speed,
  Security,
  Refresh,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDashboard } from '../../hooks/useDashboard';

const Dashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);

  // Use the specialized dashboard hook
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
    refresh,
  } = useDashboard();

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Helper functions
  const formatNumber = (num: number | undefined): string => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
  };

  const formatPercentage = (num: number): string => {
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getSystemStatusColor = () => {
    if (!isConnected) return 'error';
    if (!health?.cnnServiceHealthy || !health?.cameraConnected) return 'warning';
    return 'success';
  };

  const getSystemStatusText = () => {
    if (!isConnected) return 'Disconnected';
    if (!health?.cnnServiceHealthy || !health?.cameraConnected) return 'Partial';
    return 'Operational';
  };

  if (isLoading && !stats) {
    return (
      <Box sx={{ width: '100%', mt: 2 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 0 }}>
      {/* Header with Status and Controls */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              System Dashboard
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              <Chip
                icon={getSystemStatusColor() === 'success' ? <CheckCircle /> : 
                      getSystemStatusColor() === 'warning' ? <Warning /> : <ErrorIcon />}
                label={`System ${getSystemStatusText()}`}
                color={getSystemStatusColor()}
                variant="filled"
              />
              <Chip
                label={`${stats?.itemsToday || 0} items processed today`}
                variant="outlined"
                color="primary"
              />
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh Data">
              <IconButton 
                onClick={handleRefresh} 
                disabled={refreshing}
                color="primary"
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            {!isConnected && (
              <Button
                variant="outlined"
                color="error"
                onClick={reconnect}
                size="small"
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
          <Typography variant="subtitle2">System Error</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Today's Performance
        </Typography>
        
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" variant="body2">
                      Items Processed
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {formatNumber(stats?.itemsToday)}
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
                      Average Confidence
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {stats?.averageConfidence ? formatPercentage(stats.averageConfidence) : '0%'}
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
                      Avg Processing Time
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 600 }}>
                      {stats?.averageProcessingTime?.toFixed(0) || '0'}ms
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
                      {stats?.overrideRate ? stats.overrideRate.toFixed(1) : '0.0'}%
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
                      <TableCell>{latestClassification.processingTimeMs}ms</TableCell>
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
              </Box>
            )}
          </Paper>
        </Grid>

        {/* System Health */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 3, backgroundColor: 'white' }} elevation={1}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              System Health
            </Typography>
            {health ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Camera</Typography>
                  <Chip
                    label={health.cameraConnected ? 'Connected' : 'Disconnected'}
                    color={health.cameraConnected ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">CNN Service</Typography>
                  <Chip
                    label={health.cnnServiceHealthy ? 'Healthy' : 'Unhealthy'}
                    color={health.cnnServiceHealthy ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Arduino</Typography>
                  <Chip
                    label={health.arduinoConnected ? 'Connected' : 'Disconnected'}
                    color={health.arduinoConnected ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Expert System</Typography>
                  <Chip
                    label={health.expertSystemHealthy ? 'Healthy' : 'Unhealthy'}
                    color={health.expertSystemHealthy ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Items in Queue</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {health.itemsInQueue || 0}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Processing</Typography>
                  <Chip
                    label={health.isProcessing ? 'Active' : 'Idle'}
                    color={health.isProcessing ? 'warning' : 'default'}
                    size="small"
                  />
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                System health data unavailable
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Classification Breakdown */}
      <Paper sx={{ p: 3, mt: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Classification Breakdown
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Percentage</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(stats?.classificationBreakdown || {}).map(([category, count]) => {
                const numCount = typeof count === 'number' ? count : 0;
                const percentage = stats?.itemsToday ? (numCount / stats.itemsToday) * 100 : 0;
                return (
                  <TableRow key={category}>
                    <TableCell>{category}</TableCell>
                    <TableCell align="right">{formatNumber(numCount)}</TableCell>
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
          severity="warning"
          sx={{ mt: 3 }}
        >
          <Typography variant="subtitle2">
            System Alert - {formatDate(new Date().toISOString())}
          </Typography>
          <Typography variant="body2">{latestAlert}</Typography>
        </Alert>
      )}
    </Box>
  );
};

export default Dashboard;
