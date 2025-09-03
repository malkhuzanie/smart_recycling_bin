import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  LinearProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  GetApp,
  FilterList,
  Search,
  Refresh,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useClassificationHistory } from '../../hooks/useClassificationHistory';
import { SearchCriteria } from '../../services/api';

interface ClassificationDetails {
  id: number;
  detectionId: string;
  timestamp: string;
  finalClassification: string;
  finalConfidence: number;
  disposalLocation: string;
  reasoning: string;
  processingTimeMs: number;
  cnnPredictedClass: string;
  cnnConfidence: number;
  cnnStage: number;
  isOverridden: boolean;
  overrideReason?: string;
  sensorData?: any;
}

const ClassificationHistory: React.FC = () => {
  // State for filters and UI
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('');
  const [overrideFilter, setOverrideFilter] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<ClassificationDetails | null>(null);

  // Use the specialized classification history hook
  const {
    classifications,
    latestClassification,
    totalCount,
    loading,
    error,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    fetchClassifications,
    refreshData,
    changePage,
    clearError,
  } = useClassificationHistory();

  // Apply filters
  const applyFilters = async () => {
    const criteria: SearchCriteria = {
      limit: 50,
      offset: 0,
      sortBy: 'timestamp',
      sortDescending: true,
    };

    if (searchTerm) {
      criteria.detectionId = searchTerm;
    }
    if (classificationFilter) {
      criteria.classification = classificationFilter;
    }
    if (confidenceFilter === 'high') {
      criteria.minConfidence = 0.9;
    } else if (confidenceFilter === 'medium') {
      criteria.minConfidence = 0.7;
      criteria.maxConfidence = 0.9;
    } else if (confidenceFilter === 'low') {
      criteria.maxConfidence = 0.7;
    }
    if (overrideFilter) {
      criteria.isOverridden = overrideFilter === 'overridden';
    }

    await fetchClassifications(criteria);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setClassificationFilter('');
    setConfidenceFilter('');
    setOverrideFilter('');
    fetchClassifications({
      limit: 50,
      offset: 0,
      sortBy: 'timestamp',
      sortDescending: true,
    });
  };

  // Handle page change
  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    changePage(page);
  };

  // Show details
  const showDetails = (classification: any) => {
    setSelectedClassification(classification);
    setDetailsOpen(true);
  };

  // Download data (placeholder)
  const downloadData = () => {
    console.log('Download functionality would be implemented here');
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format confidence
  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={clearError}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Classification History
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh Data">
              <IconButton onClick={refreshData} disabled={loading}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<GetApp />}
              onClick={downloadData}
              disabled={loading}
            >
              Export
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'white' }} elevation={1}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Search by Detection ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
            />
          </Grid>
          
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Classification</InputLabel>
              <Select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value)}
                label="Classification"
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="plastic">Plastic</MenuItem>
                <MenuItem value="metal">Metal</MenuItem>
                <MenuItem value="glass">Glass</MenuItem>
                <MenuItem value="paper">Paper</MenuItem>
                <MenuItem value="cardboard">Cardboard</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Confidence</InputLabel>
              <Select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                label="Confidence"
              >
                <MenuItem value="">All Levels</MenuItem>
                <MenuItem value="high">High (&gt;90%)</MenuItem>
                <MenuItem value="medium">Medium (70-90%)</MenuItem>
                <MenuItem value="low">Low (&lt;70%)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Override Status</InputLabel>
              <Select
                value={overrideFilter}
                onChange={(e) => setOverrideFilter(e.target.value)}
                label="Override Status"
              >
                <MenuItem value="">All Records</MenuItem>
                <MenuItem value="overridden">Overridden</MenuItem>
                <MenuItem value="not_overridden">Not Overridden</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid size={{ xs: 12, md: 3 }}>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                startIcon={<Search />}
                onClick={applyFilters}
                disabled={loading}
              >
                Search
              </Button>
              <Button
                variant="outlined"
                onClick={clearFilters}
                disabled={loading}
              >
                Clear
              </Button>
            </Box>
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
                        {formatDate(classification.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        #{classification.detectionId || classification.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {classification.finalClassification}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatConfidence(classification.finalConfidence)}
                        color={getConfidenceColor(classification.finalConfidence)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {classification.processingTimeMs?.toFixed(0) || '0'}ms
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {classification.isOverridden ? (
                        <Chip
                          label="Overridden"
                          color="warning"
                          size="small"
                        />
                      ) : (
                        <Chip
                          label="Original"
                          color="default"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => showDetails(classification)}
                        >
                          <Visibility fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
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
                        <TableCell>{formatConfidence(selectedClassification.finalConfidence)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>CNN Stage 1</TableCell>
                        <TableCell>
                          {selectedClassification.cnnPredictedClass} 
                          ({formatConfidence(selectedClassification.cnnConfidence)})
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Processing Time</TableCell>
                        <TableCell>{selectedClassification.processingTimeMs?.toFixed(0) || '0'}ms</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Disposal Location</TableCell>
                        <TableCell>{selectedClassification.disposalLocation}</TableCell>
                      </TableRow>
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
                        <TableCell sx={{ fontWeight: 600 }}>Detection ID</TableCell>
                        <TableCell>{selectedClassification.detectionId}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Timestamp</TableCell>
                        <TableCell>{formatDate(selectedClassification.timestamp)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Override Status</TableCell>
                        <TableCell>
                          {selectedClassification.isOverridden ? (
                            <Chip label="Overridden" color="warning" size="small" />
                          ) : (
                            <Chip label="Original" color="success" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                      {selectedClassification.isOverridden && selectedClassification.overrideReason && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Override Reason</TableCell>
                          <TableCell>{selectedClassification.overrideReason}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Expert System Reasoning
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedClassification.reasoning || 'No reasoning provided'}
                  </Typography>
                </Grid>
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
