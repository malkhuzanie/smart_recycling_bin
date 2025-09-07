// frontend/src/components/LiveClassification/LiveClassification.tsx
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
  Badge,
  Skeleton,
  CardActions,
  Collapse
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
  Image as ImageIcon,
  Download,
  ZoomIn,
  PhotoCamera,
  Warning,
} from '@mui/icons-material';
import { useLiveClassification } from '../../hooks/useLiveClassification';
import apiService, { ClassificationResult } from '../../services/api';

const DISPOSAL_LOCATIONS: { [key: string]: string } = {
  metal: 'Metal recycling bin',
  plastic: 'Plastic recycling bin',
  glass: 'Glass recycling bin',
  paper: 'Paper recycling bin',
  cardboard: 'Cardboard/Paper recycling bin',
  PET_bottle: 'Plastic PET recycling bin',
  plastic_bag: 'Special soft plastics recycling or trash',
  container: 'Plastic recycling bin',
  food_packaging: 'Manual Inspection Bin',
  // Add other types as needed
};


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

  const [predictedLocation, setPredictedLocation] = useState<string | null>(null);

  const wasteTypes = [
    'metal', 'plastic', 'glass', 'paper', 'cardboard',
    'PET_bottle', 'plastic_bag', 'container', 'food_packaging'
  ];

  useEffect(() => {
    if (open && newClassification) {
      const location = DISPOSAL_LOCATIONS[newClassification] || 'Manual Inspection Bin';
      setPredictedLocation(location);
    } else {
      setPredictedLocation(null);
    }
  }, [newClassification, open]);

  const handleConfirm = () => {
    if (newClassification && reason) {
      onConfirm({ newClassification, reason });
      handleClose()
    }
  };

  const handleClose = () => {
    onClose();
    // Reset local state when the dialog is closed
    setNewClassification('');
    setReason('');
    setPredictedLocation(null);
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

          <Collapse in={!!predictedLocation}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                borderRadius: 1, // Matches MUI's standard border radius
                bgcolor: 'info.lighter', // A very light, unobtrusive background color
                color: 'info.darker', // Ensure text is readable
                mt: -1, // Pull it slightly closer to the dropdown above
              }}
            >
              <InfoOutlined sx={{ fontSize: '1.2rem' }} />
              <Typography variant="body2">
                Disposal location will be updated to: <strong>{predictedLocation}</strong>
              </Typography>
            </Box>
          </Collapse>

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

interface ImageZoomDialogProps {
  open: boolean;
  classification: ClassificationResult | null;
  onClose: () => void;
}

const ImageZoomDialog: React.FC<ImageZoomDialogProps> = ({ open, classification, onClose }) => {
  const handleDownload = async () => {
    if (!classification) return;
    
    try {
      await apiService.downloadClassificationImage(classification.id);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Classification Image - {classification?.detectionId}
          </Typography>
          <IconButton onClick={handleDownload} disabled={!classification?.hasImage}>
            <Download />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {classification?.hasImage && apiService.getImageUrl(classification) ? (
          <img
            src={apiService.getImageUrl(classification)!}
            alt="Classification"
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '70vh',
              objectFit: 'contain',
              backgroundColor: '#f5f5f5'
            }}
          />
        ) : (
          <Box 
            display="flex" 
            justifyContent="center" 
            alignItems="center" 
            height={400}
            bgcolor="grey.100"
          >
            <Typography color="text.secondary">
              No image available
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const LiveClassification: React.FC = () => {
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [imageZoomDialogOpen, setImageZoomDialogOpen] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<ClassificationResult | null>(null);

  // Use the specialized live classification hook
  const {
    currentClassification,
    previousClassifications,
    isProcessing,
    systemStatus,
    error,
    overrideClassification,
    approveClassification,
    rejectClassification,
    requestReclassification,
    triggerManualCapture,
    clearError,
  } = useLiveClassification();

  const handleOverride = async (overrideDataFromDialog: { classificationId: number; newClassification: string; reason: string; userId: string; }) => {
    try {
      const newDisposalLocation = DISPOSAL_LOCATIONS[overrideDataFromDialog.newClassification] || 'Manual Inspection Bin';

      const fullOverrideRequest = {
        ...overrideDataFromDialog,
        newDisposalLocation: newDisposalLocation,
      };

      console.log('Sending full override request:', fullOverrideRequest);
      const success = await overrideClassification(fullOverrideRequest);
      
      if (!success) {
        console.error('Override failed');
      }
    } catch (error) {
      console.error('Failed to override classification:', error);
    }
  };

  const handleImageZoom = (classification: ClassificationResult) => {
    setSelectedClassification(classification);
    setImageZoomDialogOpen(true);
  };

  const handleManualCapture = async () => {
    try {
      await triggerManualCapture();
    } catch (error) {
      console.error('Failed to trigger manual capture:', error);
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

  const formatImageInfo = (classification: ClassificationResult) => {
    if (!classification.hasImage) return 'No image';
    
    const size = apiService.formatImageSize(classification.imageSizeBytes);
    const format = classification.imageFormat?.toUpperCase() || 'Unknown';
    const dimensions = classification.imageDimensions || 'Unknown';
    
    return `${format} • ${dimensions} • ${size}`;
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Error Alert */}
      {error && (
        <Alert 
          severity="error" 
          onClose={clearError}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ px: 3, py: 2, mb: 2 }} elevation={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Live Classification Monitor
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Chip 
              icon={<Camera />}
              label={systemStatus.isConnected ? 'Connected' : 'Disconnected'}
              color={systemStatus.isConnected ? 'success' : 'error'}
              variant="outlined"
            />
            <Chip 
              label={`Camera: ${systemStatus.cameraConnected ? 'On' : 'Off'}`}
              color={systemStatus.cameraConnected ? 'success' : 'default'}
              size="small"
              variant="outlined"
            />
            <Badge 
              badgeContent={systemStatus.imageStorageEnabled ? '📷' : '❌'} 
              color={systemStatus.imageStorageEnabled ? 'success' : 'error'}
            >
              <Chip 
                label="Image Storage"
                size="small"
                variant="outlined"
              />
            </Badge>
            <Button
              variant="outlined"
              startIcon={<PhotoCamera />}
              onClick={handleManualCapture}
              disabled={!systemStatus.cameraConnected || isProcessing}
              size="small"
            >
              Manual Capture
            </Button>
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
        
        {/* LEFT PANE - Current Image and Details */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }} elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Camera color="primary" />
              Current Item
              {isProcessing && (
                <Chip 
                  label="Processing..." 
                  size="small" 
                  color="info" 
                  variant="outlined" 
                />
              )}
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
                {/* 🖼️ IMAGE DISPLAY WITH ENHANCED FEATURES */}
                <Box sx={{ position: 'relative' }}>
                  {currentClassification.hasImage && apiService.getImageUrl(currentClassification) ? (
                    <CardMedia
                      component="img"
                      sx={{ 
                        height: 400, 
                        objectFit: 'contain',
                        bgcolor: 'grey.100',
                        cursor: 'pointer'
                      }}
                      image={apiService.getImageUrl(currentClassification)!}
                      alt="Current item being classified"
                      onClick={() => handleImageZoom(currentClassification)}
                    />
                  ) : (
                    <Box
                      sx={{
                        height: 400,
                        bgcolor: 'grey.200',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: 2
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 80, color: 'grey.400' }} />
                      <Typography variant="body1" color="text.secondary">
                        {currentClassification.hasImage ? 'Image Loading...' : 'No Image Available'}
                      </Typography>
                      {!systemStatus.cameraConnected && (
                        <Chip 
                          icon={<Warning />} 
                          label="Camera Disconnected" 
                          color="warning" 
                          size="small" 
                        />
                      )}
                    </Box>
                  )}
                  
                  {/* 🖼️ IMAGE OVERLAY CONTROLS */}
                  {currentClassification.hasImage && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        gap: 1
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white' }}
                        onClick={() => handleImageZoom(currentClassification)}
                      >
                        <ZoomIn />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white' }}
                        onClick={() => apiService.downloadClassificationImage(currentClassification.id)}
                      >
                        <Download />
                      </IconButton>
                    </Box>
                  )}
                </Box>

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
                  
                  {/* 🖼️ IMAGE INFO */}
                  {currentClassification.hasImage && (
                    <Box display="flex" gap={1} mb={2}>
                      <Chip
                        icon={<ImageIcon />}
                        label={formatImageInfo(currentClassification)}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                      {currentClassification.imageCaptureTimestamp && (
                        <Chip
                          label={`Captured: ${formatTimestamp(currentClassification.imageCaptureTimestamp)}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  )}
                  
                  <Box display="flex" gap={1} mb={2}>
                    <Chip
                      label={`${(currentClassification.processingTimeMs || 0).toFixed(0)}ms`}
                      size="small"
                      color="info"
                      variant="outlined"
                    />
                    <Chip
                      label={`${(currentClassification.finalConfidence * 100).toFixed(1)}%`}
                      size="small"
                      color={getConfidenceColor(currentClassification.finalConfidence)}
                      variant="outlined"
                    />
                  </Box>
                  
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Classification</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {currentClassification.finalClassification.toUpperCase()}
                            </Typography>
                            <Chip
                              label={`${(currentClassification.finalConfidence * 100).toFixed(1)}%`}
                              size="small"
                              color={getConfidenceColor(currentClassification.finalConfidence)}
                              variant="filled"
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Disposal Location</TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationOn fontSize="small" color="action" />
                            {currentClassification.disposalLocation}
                          </Box>
                        </TableCell>
                      </TableRow>
                      {currentClassification.reasoning && (
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Reasoning</TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Psychology fontSize="small" color="action" />
                              {currentClassification.reasoning}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <ButtonGroup variant="outlined" size="small">
                    <Button
                      startIcon={<CheckCircle />}
                      color="success"
                      onClick={() => approveClassification(currentClassification.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      startIcon={<Cancel />}
                      color="error"
                      onClick={() => rejectClassification(currentClassification.id, "Manual rejection")}
                    >
                      Reject
                    </Button>
                  </ButtonGroup>
                  
                  <Button
                    startIcon={<Edit />}
                    color="warning"
                    variant="outlined"
                    onClick={() => {
                      setSelectedClassification(currentClassification);
                      setOverrideDialogOpen(true);
                    }}
                  >
                    Override
                  </Button>
                </CardActions>
              </Card>
            ) : (
              <Card sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box textAlign="center" py={8}>
                  <Camera sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" mb={1}>
                    Waiting for item...
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Place an item in front of the camera to start classification
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<PhotoCamera />}
                    onClick={handleManualCapture}
                    disabled={!systemStatus.cameraConnected}
                  >
                    Trigger Manual Capture
                  </Button>
                </Box>
              </Card>
            )}
          </Box>
        </Paper>

        {/* RIGHT PANE - Previous Classifications */}
        <Paper sx={{ width: 400, display: 'flex', flexDirection: 'column' }} elevation={2}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Recent Classifications ({previousClassifications.length})
            </Typography>
          </Box>
          
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            <Stack spacing={1}>
              {previousClassifications.map((classification) => (
                <Card key={classification.id} variant="outlined" sx={{ cursor: 'pointer' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {classification.finalClassification.toUpperCase()}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        {classification.hasImage && (
                          <IconButton 
                            size="small"
                            onClick={() => handleImageZoom(classification)}
                          >
                            <ImageIcon fontSize="small" />
                          </IconButton>
                        )}
                        <Chip
                          label={`${(classification.finalConfidence * 100).toFixed(0)}%`}
                          size="small"
                          color={getConfidenceColor(classification.finalConfidence)}
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      {formatTimestamp(classification.timestamp)} • {classification.detectionId}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      📍 {classification.disposalLocation}
                    </Typography>
                    
                    {classification.hasImage && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 0.5 }}>
                        🖼️ {formatImageInfo(classification)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        </Paper>
      </Box>

      {/* Dialogs */}
      <OverrideDialog
        open={overrideDialogOpen}
        classification={selectedClassification}
        onClose={() => {
          setOverrideDialogOpen(false);
          setSelectedClassification(null);
        }}
        onConfirm={(data) => {
          if (selectedClassification) {
            handleOverride({
              classificationId: selectedClassification.id,
              newClassification: data.newClassification,
              reason: data.reason,
              userId: 'operator_ui', 
            });
          }
        }}
      />

      <ImageZoomDialog
        open={imageZoomDialogOpen}
        classification={selectedClassification}
        onClose={() => {
          setImageZoomDialogOpen(false);
          setSelectedClassification(null);
        }}
      />
    </Box>
  );
};

export default LiveClassification;
