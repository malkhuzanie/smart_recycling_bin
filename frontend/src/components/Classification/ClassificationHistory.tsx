import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  CardContent,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  MenuItem,
  Pagination,
  LinearProgress,
  Button,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent, // <-- FIXED: Import SelectChangeEvent
} from '@mui/material';
import {
  History,
  FilterList,
  Download,
  Search,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Visibility,
  Refresh,
} from '@mui/icons-material';
import { api } from '../../services/api';
import { useSignalR } from '../../hooks/useSignalR';
import { ClassificationResult } from '../../types';

const ClassificationHistory: React.FC = () => {
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);
  const [filterBy, setFilterBy] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<ClassificationResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Use SignalR for real-time updates
  const { latestClassification } = useSignalR();

  // Fetch classifications data
  const fetchClassifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.getRecentClassifications(
        page, 
        pageSize, 
        filterBy || undefined
      );
      
      setClassifications(response.items);
      setTotalPages(response.totalPages);
      setTotalCount(response.totalCount);
    } catch (err) {
      console.error('Error fetching classifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load classifications');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch and refresh on filter changes
  useEffect(() => {
    fetchClassifications();
  }, [page, filterBy]);

  // Add new classification from SignalR to the top of the list
  useEffect(() => {
    if (latestClassification && page === 1) {
      setClassifications(prev => {
        // Check if this classification already exists
        if (prev.some(c => c.id === latestClassification.id)) {
          return prev;
        }
        
        // Add to the beginning and maintain page size
        const updated = [latestClassification, ...prev];
        return updated.slice(0, pageSize);
      });
      
      setTotalCount(prev => prev + 1);
    }
  }, [latestClassification, page, pageSize]);

  const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
    setPage(newPage);
  };

  // FIXED: Changed the event type to SelectChangeEvent
  const handleFilterChange = (event: SelectChangeEvent) => {
    setFilterBy(event.target.value);
    setPage(1); // Reset to first page when filter changes
  };

  const handleExportData = async () => {
    try {
      const blob = await api.exportClassifications();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `classifications_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleViewDetails = (classification: ClassificationResult) => {
    setSelectedClassification(classification);
    setDetailsOpen(true);
  };

  const getValidationIcon = (status: 'pass' | 'fail') => {
    return status === 'pass' ? (
      <CheckCircle color="success" fontSize="small" />
    ) : (
      <ErrorIcon color="error" fontSize="small" />
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'success';
    if (confidence >= 85) return 'warning';
    return 'error';
  };

  // Get unique classification types for filter dropdown
  const uniqueClassifications = Array.from(
    new Set(classifications.map(c => c.finalClassification))
  ).sort();

  if (loading && classifications.length === 0) {
    return (
      <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <Typography variant="h4" gutterBottom>
          Classification History
        </Typography>
        <LinearProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading classification data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <History sx={{ mr: 2, fontSize: '2rem', color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                Classification History
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Complete record of all processed items
              </Typography>
            </Box>
          </Box>
          
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchClassifications}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleExportData}
            >
              Export Data
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">Error Loading Data</Typography>
          {error}
        </Alert>
      )}

      {/* Filters and Controls */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Search & Filter
        </Typography>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Search"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth>
              <InputLabel>Filter by Classification</InputLabel>
              <Select
                value={filterBy}
                label="Filter by Classification"
                onChange={handleFilterChange}
              >
                <MenuItem value="">All Classifications</MenuItem>
                {uniqueClassifications.map((classification) => (
                  <MenuItem key={classification} value={classification}>
                    {classification}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, md: 4 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <FilterList color="primary" />
              <Typography variant="body2" color="text.secondary">
                {totalCount.toLocaleString()} total records
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Classifications Table */}
      <Paper sx={{ backgroundColor: 'white' }} elevation={1}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Classification Records
          </Typography>
          
          {loading && <LinearProgress sx={{ mb: 2 }} />}
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Date & Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Item ID</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Classification</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Confidence</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Processing Time</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {classifications.map((classification) => (
                  <TableRow key={classification.id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(classification.timestamp).toLocaleString()}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        #{classification.id}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {classification.finalClassification}
                        </Typography>
                        {classification.isOverridden && (
                          <Chip 
                            label="Override Applied"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        label={`${(classification.finalConfidence * 100).toFixed(1)}%`}
                        size="small"
                        color={getConfidenceColor(classification.finalConfidence * 100)}
                        variant="outlined"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {classification.processingTime?.toFixed(0) || 0}ms
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        {classification.sensorValidation ? (
                          <>
                            <Box title="Weight Sensor">
                              {getValidationIcon(classification.sensorValidation.weight)}
                            </Box>
                            <Box title="Metal Detector">
                              {getValidationIcon(classification.sensorValidation.metal)}
                            </Box>
                            <Box title="Humidity Sensor">
                              {getValidationIcon(classification.sensorValidation.humidity)}
                            </Box>
                            <Box title="IR Spectroscopy">
                              {getValidationIcon(classification.sensorValidation.ir_spectroscopy)}
                            </Box>
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No validation data
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(classification)}
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <Box display="flex" justifyContent="center" sx={{ mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
            />
          </Box>
        </Box>
      </Paper>

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Classification Details - ID #{selectedClassification?.id}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedClassification && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Classification Results
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Final Classification</TableCell>
                        <TableCell>{selectedClassification.finalClassification}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Confidence</TableCell>
                        <TableCell>{(selectedClassification.finalConfidence * 100).toFixed(1)}%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>CNN Stage 1</TableCell>
                        <TableCell>
                          {selectedClassification.cnnStage1Class} 
                          ({((selectedClassification.cnnStage1Confidence || 0) * 100).toFixed(1)}%)
                        </TableCell>
                      </TableRow>
                      {selectedClassification.cnnStage2Class && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>CNN Stage 2</TableCell>
                          <TableCell>
                            {selectedClassification.cnnStage2Class} 
                            ({((selectedClassification.cnnStage2Confidence || 0) * 100).toFixed(1)}%)
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Grid>
                
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    System Information
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Processing Time</TableCell>
                        <TableCell>{selectedClassification.processingTime?.toFixed(0) || 0}ms</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                        <TableCell>{new Date(selectedClassification.timestamp).toLocaleString()}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Disposal Location</TableCell>
                        <TableCell>{selectedClassification.disposalLocation}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Decision Path</TableCell>
                        <TableCell>
                          {(selectedClassification.decisionPath || 'standard_classification').replace(/_/g, ' → ')}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Grid>
                
                {selectedClassification.sensorValidation && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      Sensor Validation Results
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Sensor</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(selectedClassification.sensorValidation).map(([sensor, status]) => (
                          <TableRow key={sensor}>
                            <TableCell>{sensor.replace('_', ' ').toUpperCase()}</TableCell>
                            <TableCell>
                              {getValidationIcon(status as 'pass' | 'fail')}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={status.toUpperCase()}
                                size="small"
                                color={status === 'pass' ? 'success' : 'error'}
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Grid>
                )}
                
                {selectedClassification.overrideInfo?.isOverridden && (
                  <Grid size={{ xs: 12 }}>
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Manual Override Applied
                      </Typography>
                      <Typography variant="body2">
                        Original: {selectedClassification.overrideInfo.originalClassification}
                      </Typography>
                      <Typography variant="body2">
                        Reason: {selectedClassification.overrideInfo.reason}
                      </Typography>
                      <Typography variant="body2">
                        By: {selectedClassification.overrideInfo.overriddenBy} on{' '}
                        {selectedClassification.overrideInfo.overrideTimestamp && 
                          new Date(selectedClassification.overrideInfo.overrideTimestamp).toLocaleString()}
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClassificationHistory;
