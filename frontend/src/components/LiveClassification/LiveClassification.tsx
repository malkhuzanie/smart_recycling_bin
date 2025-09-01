import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
  ButtonGroup,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  Stack,
} from '@mui/material';
import {
  Camera,
  CheckCircle,
  Cancel,
  Edit,
  Save,
  Refresh,
  InfoOutlined,
  AccessTime,
  Save as Accuracy,
  LocationOn,
  Psychology,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useSignalR } from '../../hooks/useSignalR';

interface ClassificationResult {
  id: number;
  detectionId: string;
  timestamp: string;
  finalClassification: string;
  finalConfidence: number;
  disposalLocation: string;
  reasoning: string;
  processingTimeMs: number;
  imageBase64?: string;
  cnnStages?: {
    stage1Result?: any;
    stage2Result?: any;
    totalConfidence: number;
  };
  sensorData?: {
    weightGrams: number;
    isMetalDetected: boolean;
    humidityPercent: number;
    temperatureCelsius: number;
    isMoist: boolean;
    isTransparent: boolean;
    isFlexible: boolean;
  };
  validationResults?: {
    [key: string]: string;
  };
}

interface OverrideDialogProps {
  open: boolean;
  classification: ClassificationResult | null;
  onClose: () => void;
  onConfirm: (overrideData: any) => void;
}

const OverrideDialog: React.FC<OverrideDialogProps> = ({ 
  open, 
  classification, 
  onClose, 
  onConfirm 
}) => {
  const [newClassification, setNewClassification] = useState('');
  const [reason, setReason] = useState('');

  const wasteTypes = [
    'metal', 'plastic', 'glass', 'paper', 'cardboard',
    'PET_bottle', 'plastic_bag', 'container', 'food_packaging'
  ];

  const handleConfirm = () => {
    if (newClassification && reason) {
      onConfirm({
        classificationId: classification?.id,
        newClassification,
        reason,
        userId: 'operator' // In real app, get from auth
      });
      setNewClassification('');
      setReason('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Override Classification Result
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={3}>
          <Alert severity="warning">
            <Typography variant="body2">
              You are about to override the system's classification. 
              This action will be logged for quality control purposes.
            </Typography>
          </Alert>
          
          <FormControl fullWidth>
            <InputLabel>New Classification</InputLabel>
            <Select
              value={newClassification}
              onChange={(e) => setNewClassification(e.target.value)}
              label="New Classification"
            >
              {wasteTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type.replace('_', ' ').toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Reason for Override"
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please explain why you're overriding this classification..."
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={handleConfirm} 
          variant="contained" 
          disabled={!newClassification || !reason}
          color="warning"
        >
          Confirm Override
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const LiveClassification: React.FC = () => {
  const [currentClassification, setCurrentClassification] = useState<ClassificationResult | null>(null);
  const [previousClassifications, setPreviousClassifications] = useState<ClassificationResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState('Connected');
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

  // SignalR connection for real-time updates
  const { isConnected, lastMessage } = useSignalR('ws://localhost:5000/classification-hub');

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'classification_result') {
      const newResult = lastMessage.data as ClassificationResult;
      setCurrentClassification(newResult);
      setIsProcessing(false);
      
      // Add to previous classifications (keep last 10)
      setPreviousClassifications(prev => [newResult, ...prev.slice(0, 9)]);
    } else if (lastMessage && lastMessage.type === 'processing_started') {
      setIsProcessing(true);
    }
  }, [lastMessage]);

  const handleOverride = async (overrideData: any) => {
    try {
      // Call API to override classification
      const response = await fetch('/api/classification/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(overrideData),
      });

      if (response.ok) {
        // Update current classification to reflect override
        if (currentClassification) {
          setCurrentClassification({
            ...currentClassification,
            finalClassification: overrideData.newClassification,
            reasoning: `Override: ${overrideData.reason}`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to override classification:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'error';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ px: 3, py: 2, mb: 2 }} elevation={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Live Classification Monitor
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Chip 
              icon={<Camera />}
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              variant="outlined"
            />
            <Tooltip title="System Settings">
              <IconButton>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Paper>

      {/* Main Content - Two Panes */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
        {/* Left Pane - Current Image */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }} elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Camera color="primary" />
              Current Item
            </Typography>
          </Box>
          
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
            {isProcessing && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Processing classification...
                </Typography>
              </Box>
            )}

            {currentClassification ? (
              <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  component="img"
                  sx={{ 
                    height: 400, 
                    objectFit: 'contain',
                    bgcolor: 'grey.100'
                  }}
                  image={currentClassification.imageBase64 
                    ? `data:image/jpeg;base64,${currentClassification.imageBase64}` 
                    : '/api/placeholder/400/400'
                  }
                  alt="Current item being classified"
                />
                <CardContent sx={{ flex: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Item #{currentClassification.detectionId}
                    </Typography>
                    <Chip
                      icon={<AccessTime />}
                      label={formatTimestamp(currentClassification.timestamp)}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  
                  <Box display="flex" gap={1} mb={2}>
                    <Chip
                      label={`${(currentClassification.processingTimeMs || 0).toFixed(0)}ms`}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                    <Chip
                      label={`${currentClassification.cnnStages?.totalConfidence ? 
                        (currentClassification.cnnStages.totalConfidence * 100).toFixed(1) : 
                        (currentClassification.finalConfidence * 100).toFixed(1)}% confidence`}
                      size="small"
                      color={getConfidenceColor(currentClassification.finalConfidence)}
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Camera sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    Waiting for next item...
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    Place an item on the conveyor belt to start classification
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Box>
        </Paper>

        {/* Right Pane - Classification Results & Override */}
        <Paper sx={{ width: 400, display: 'flex', flexDirection: 'column' }} elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Psychology color="primary" />
              Classification Result
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {currentClassification ? (
              <Box sx={{ p: 2 }}>
                {/* Final Classification Result */}
                <Card sx={{ mb: 2, border: 2, borderColor: 'primary.main' }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Final Classification
                      </Typography>
                      <Chip
                        icon={<CheckCircle />}
                        label="Classified"
                        color="success"
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: 'primary.main' }}>
                      {currentClassification.finalClassification.replace('_', ' ').toUpperCase()}
                    </Typography>
                    
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <LocationOn color="action" fontSize="small" />
                      <Typography variant="body2" color="text.secondary">
                        {currentClassification.disposalLocation}
                      </Typography>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1}>
                      <Accuracy color="action" fontSize="small" />
                      <Typography variant="body2">
                        Confidence: <strong>{(currentClassification.finalConfidence * 100).toFixed(1)}%</strong>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>

                {/* Detailed Analysis */}
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                      Detailed Analysis
                    </Typography>
                    
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 1 }}>Stage 1 (Material)</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            {currentClassification.cnnStages?.stage1Result?.predicted_class || 'N/A'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 1 }}>Stage 2 (Subtype)</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            {currentClassification.cnnStages?.stage2Result?.predicted_class || 'N/A'}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, py: 1 }}>Processing Time</TableCell>
                          <TableCell sx={{ py: 1 }}>
                            {currentClassification.processingTimeMs?.toFixed(0) || '0'}ms
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Sensor Data */}
                {currentClassification.sensorData && (
                  <Card sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                        Sensor Validation
                      </Typography>
                      
                      <Grid container spacing={1}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2">Weight:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {currentClassification.sensorData.weightGrams.toFixed(1)}g
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2">Metal:</Typography>
                          <Chip
                            label={currentClassification.sensorData.isMetalDetected ? 'Yes' : 'No'}
                            size="small"
                            color={currentClassification.sensorData.isMetalDetected ? 'success' : 'default'}
                          />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2">Humidity:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {currentClassification.sensorData.humidityPercent.toFixed(1)}%
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2">Flexible:</Typography>
                          <Chip
                            label={currentClassification.sensorData.isFlexible ? 'Yes' : 'No'}
                            size="small"
                            color={currentClassification.sensorData.isFlexible ? 'info' : 'default'}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                )}

                {/* Expert System Reasoning */}
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                      Expert System Reasoning
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {currentClassification.reasoning}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <InfoOutlined sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No classification data available
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Results will appear here when an item is processed
                </Typography>
              </Box>
            )}
          </Box>

          {/* Override Controls */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Manual Override
            </Typography>
            
            <ButtonGroup fullWidth variant="outlined" size="large">
              <Button
                startIcon={<CheckCircle />}
                color="success"
                disabled={!currentClassification}
              >
                Approve
              </Button>
              <Button
                startIcon={<Edit />}
                color="warning"
                disabled={!currentClassification}
                onClick={() => setOverrideDialogOpen(true)}
              >
                Override
              </Button>
              <Button
                startIcon={<Cancel />}
                color="error"
                disabled={!currentClassification}
              >
                Reject
              </Button>
            </ButtonGroup>

            <Button
              fullWidth
              startIcon={<Refresh />}
              variant="text"
              size="small"
              sx={{ mt: 1 }}
              disabled={!currentClassification}
            >
              Request Reclassification
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Override Dialog */}
      <OverrideDialog
        open={overrideDialogOpen}
        classification={currentClassification}
        onClose={() => setOverrideDialogOpen(false)}
        onConfirm={handleOverride}
      />
    </Box>
  );
};

export default LiveClassification;
