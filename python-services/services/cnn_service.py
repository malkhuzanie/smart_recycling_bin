"""
Enhanced CNN Service - Full Process Orchestration
Integrates Arduino sensors, CNN processing, and expert system
"""

import asyncio
import cv2
import numpy as np
import tensorflow as tf
from typing import Dict, Optional, List, Tuple
from datetime import datetime
import logging
import json
import sys
import os
from pathlib import Path

# Add src to path to import expert system
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from .hub_client import SignalRHubClient

try:
    # Import expert system components
    from smart_bin.core.knowledge_engine import SmartBinKnowledgeEngine
    from smart_bin.core.facts import WasteFact
    from smart_bin.models.waste_types import WasteCategory
except ImportError as e:
    logging.warning(f"Could not import expert system components: {e}")
    SmartBinKnowledgeEngine = None
    WasteFact = None

class CNNService:
    """Enhanced CNN Service with full process orchestration"""
    
    def __init__(self, model_path: str, backend_hub_url: str = "http://localhost:5099/hubs/classification"):
        self.model_path = model_path
        self.model = None
        self.camera = None
        self.hub_client = SignalRHubClient(backend_hub_url, "ClassificationHub")
        self.logger = logging.getLogger("EnhancedCNNService")
        
        # Model configuration
        self.classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic']
        self.confidence_threshold = 0.85
        self.expert_system = SmartBinKnowledgeEngine() if SmartBinKnowledgeEngine else None
        
        # Arduino communication
        self.arduino_service = None  # Will be injected
        
        # Processing queue for items
        self.processing_queue = asyncio.Queue()
        self.is_processing = False
        
    async def start_service(self):
        """Start the enhanced CNN service with full orchestration"""
        self.logger.info("🚀 Starting Enhanced CNN Service with Full Orchestration...")
        
        try:
            # Load the CNN model
            await self.load_model()
            
            # Connect to SignalR hub
            if not await self.hub_client.connect():
                self.logger.error("Failed to connect to backend hub")
                return
                
            # Join classification group
            await self.hub_client.send_message("JoinClassificationGroup", "")
            
            # Initialize camera
            await self.initialize_camera()
            
            # Start processing workers
            await asyncio.gather(
                self.item_detection_worker(),
                self.classification_worker(),
                self.heartbeat_worker()
            )
            
        except Exception as e:
            self.logger.error(f"Failed to start enhanced CNN service: {e}")
            raise

    async def load_model(self):
        """Load the TensorFlow model"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            self.logger.info(f"Loading model from: {self.model_path}")
            self.model = tf.keras.models.load_model(self.model_path)
            self.logger.info("✅ CNN model loaded successfully")
            
            # Log model info
            self.logger.info(f"Model input shape: {self.model.input_shape}")
            self.logger.info(f"Model output shape: {self.model.output_shape}")
            
        except Exception as e:
            self.logger.error(f"Failed to load model: {e}")
            raise
    
    async def initialize_camera(self):
        """Initialize USB camera"""
        try:
            camera_index = int(os.getenv('CAMERA_INDEX', '0'))
            self.camera = cv2.VideoCapture(camera_index)
            
            if not self.camera.isOpened():
                raise Exception(f"Cannot open camera at index {camera_index}")
            
            # Set camera properties
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 384)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 384)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            self.logger.info("✅ Camera initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize camera: {e}")
            # Continue without camera for testing
            self.camera = None

    async def item_detection_worker(self):
        """Worker that detects when items are placed for processing"""
        self.logger.info("🔍 Item detection worker started")
        
        while True:
            try:
                # For demonstration, trigger every 10 seconds
                # In real implementation, this would be triggered by:
                # 1. Arduino sensor detecting item placement
                # 2. External API call
                # 3. Manual trigger from dashboard
                
                await asyncio.sleep(10)
                
                # Mock item detection - replace with actual trigger logic
                item_data = {
                    "detection_id": f"item_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    "timestamp": datetime.now().isoformat(),
                    "trigger_source": "mock_sensor",
                    "item_present": True
                }
                
                self.logger.info(f"📦 Item detected: {item_data['detection_id']}")
                
                # Add to processing queue
                await self.processing_queue.put(item_data)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.logger.error(f"Error in item detection worker: {e}")
                await asyncio.sleep(1)

    async def classification_worker(self):
        """Worker that processes items through the full classification pipeline"""
        self.logger.info("🔄 Classification worker started")
        
        while True:
            try:
                # Wait for item to process
                item_data = await self.processing_queue.get()
                
                if self.is_processing:
                    self.logger.warning("Already processing an item, queuing...")
                    await self.processing_queue.put(item_data)  # Put it back
                    await asyncio.sleep(0.1)
                    continue
                
                self.is_processing = True
                
                try:
                    # Process the complete classification pipeline
                    result = await self.process_complete_pipeline(item_data)
                    
                    if result:
                        # Send result to backend
                        await self.send_classification_result(result)
                    
                finally:
                    self.is_processing = False
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.logger.error(f"Error in classification worker: {e}")
                self.is_processing = False

    async def process_complete_pipeline(self, item_data: Dict) -> Optional[Dict]:
        """Process complete classification pipeline: sensors → CNN → expert system"""
        try:
            start_time = datetime.now()
            detection_id = item_data["detection_id"]
            
            self.logger.info(f"🔬 Starting complete pipeline for {detection_id}")
            
            # Step 1: Capture image
            self.logger.info("📷 Capturing image...")
            image_array = await self.capture_image()
            if image_array is None:
                self.logger.error("Failed to capture image")
                return None
            
            # Step 2: Get sensor data from Arduino
            self.logger.info("📊 Reading sensor data...")
            sensor_data = await self.get_sensor_data()
            
            # Step 3: CNN Stage 1 processing
            self.logger.info("🧠 Running CNN Stage 1 classification...")
            stage1_result = await self.run_cnn_stage1(image_array)
            
            # Step 4: CNN Stage 2 processing (if needed)
            stage2_result = None
            if stage1_result.get("predicted_class") == "plastic" and stage1_result.get("confidence", 0) > self.confidence_threshold:
                self.logger.info("🧠 Running CNN Stage 2 (plastic specialization)...")
                stage2_result = await self.run_cnn_stage2(image_array)
            
            # Step 5: Expert system integration
            self.logger.info("🎯 Running expert system validation...")
            expert_result = await self.run_expert_system_integration(
                stage1_result, 
                stage2_result, 
                sensor_data
            )
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Compile complete result
            complete_result = {
                "detection_id": detection_id,
                "timestamp": item_data["timestamp"],
                "processing_time_ms": processing_time,
                
                # CNN Results
                "cnn_prediction": {
                    "stage1": stage1_result,
                    "stage2": stage2_result,
                    "total_confidence": expert_result.get("confidence", 0)
                },
                
                # Sensor Data
                "sensor_data": sensor_data,
                
                # Expert System Result  
                "expert_system_result": expert_result,
                
                # Processing Metadata
                "processing_metadata": {
                    "pipeline_version": "enhanced_v1.0",
                    "model_version": "trash_classifier_v3_93",
                    "processing_node": os.uname().nodename if hasattr(os, 'uname') else 'unknown',
                    "stages_completed": ["stage1", "stage2" if stage2_result else None, "expert_system"],
                    "fallback_used": stage1_result.get("confidence", 0) < self.confidence_threshold
                }
            }
            
            self.logger.info(f"✅ Pipeline complete for {detection_id}: {expert_result.get('final_classification')} (confidence: {expert_result.get('confidence', 0):.2f})")
            
            return complete_result
            
        except Exception as e:
            self.logger.error(f"Error in complete pipeline: {e}")
            return None

    async def get_sensor_data(self) -> Dict:
        """Get sensor data from Arduino service or mock data"""
        try:
            if self.arduino_service:
                # Get real sensor data from Arduino service
                return await self.arduino_service.read_sensors()
            else:
                # Mock sensor data for development
                import random
                return {
                    "weight_grams": random.uniform(5, 500),
                    "is_metal": random.choice([True, False]),
                    "humidity_percent": random.uniform(20, 80),
                    "temperature_celsius": random.uniform(18, 25),
                    "is_moist": random.choice([True, False]),
                    "is_transparent": random.choice([True, False]),
                    "is_flexible": random.choice([True, False]),
                    "ir_transparency": random.uniform(0.3, 0.9),
                    "sensor_timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            self.logger.error(f"Error getting sensor data: {e}")
            return {}

    async def run_cnn_stage1(self, image: np.ndarray) -> Dict:
        """Run Stage 1 CNN classification"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image)
            
            # Run prediction
            predictions = self.model.predict(processed_image, verbose=0)
            
            # Extract results
            confidence = float(np.max(predictions))
            class_idx = int(np.argmax(predictions))
            predicted_class = self.classes[class_idx]
            
            return {
                "stage": 1,
                "predicted_class": predicted_class,
                "confidence": confidence,
                "class_probabilities": {
                    class_name: float(prob) 
                    for class_name, prob in zip(self.classes, predictions[0])
                },
                "processing_stage": "stage1_cnn",
                "requires_stage2": predicted_class == "plastic" and confidence > self.confidence_threshold
            }
            
        except Exception as e:
            self.logger.error(f"Stage 1 CNN failed: {e}")
            return {
                "stage": 1,
                "predicted_class": "unknown",
                "confidence": 0.0,
                "error": str(e)
            }

    async def run_cnn_stage2(self, image: np.ndarray) -> Dict:
        """Run Stage 2 CNN classification (plastic specialization)"""
        try:
            # In real implementation, this would use a specialized plastic model
            # For now, simulate plastic subcategorization
            plastic_types = ['PET_bottle', 'plastic_bag', 'container', 'food_packaging']
            
            # Mock plastic classification - replace with actual Stage 2 model
            import random
            predicted_plastic = random.choice(plastic_types)
            confidence = random.uniform(0.7, 0.95)
            
            return {
                "stage": 2,
                "predicted_class": predicted_plastic,
                "confidence": confidence,
                "plastic_subcategory": predicted_plastic,
                "processing_stage": "stage2_plastic_cnn"
            }
            
        except Exception as e:
            self.logger.error(f"Stage 2 CNN failed: {e}")
            return {
                "stage": 2,
                "predicted_class": "plastic_unknown",
                "confidence": 0.0,
                "error": str(e)
            }

    async def run_expert_system_integration(self, stage1_result: Dict, stage2_result: Optional[Dict], sensor_data: Dict) -> Dict:
        """Run expert system with CNN and sensor integration"""
        try:
            if not self.expert_system or not WasteFact:
                self.logger.warning("Expert system not available, using CNN results")
                return self.create_fallback_result(stage1_result, stage2_result)
            
            # Determine the CV label and confidence to use
            if stage2_result and stage2_result.get("confidence", 0) > 0.7:
                cv_label = stage2_result["predicted_class"]
                cv_confidence = stage2_result["confidence"]
            else:
                cv_label = stage1_result["predicted_class"]
                cv_confidence = stage1_result["confidence"]
            
            # Create WasteFact for expert system
            waste_fact = WasteFact(
                cv_label=cv_label,
                cv_confidence=cv_confidence,
                is_metal=sensor_data.get('is_metal', False),
                is_moist=sensor_data.get('is_moist', False),
                is_transparent=sensor_data.get('is_transparent', False),
                is_flexible=sensor_data.get('is_flexible', False),
                weight_grams=sensor_data.get('weight_grams', 0.0)
            )
            
            # Run expert system
            self.expert_system.reset_classification()
            self.expert_system.declare(waste_fact)
            self.expert_system.run()
            
            decision = self.expert_system.get_final_decision()
            
            if decision.final_classification:
                return {
                    "final_classification": decision.final_classification.category.value,
                    "confidence": decision.confidence_score,
                    "disposal_location": decision.final_classification.disposal_location,
                    "reasoning": decision.final_classification.reasoning,
                    "candidates_count": len(decision.candidates),
                    "processing_stage": "expert_system_validated",
                    "validation_results": {
                        "weight_validation": "pass" if sensor_data.get('weight_grams', 0) > 0 else "fail",
                        "metal_validation": "pass" if sensor_data.get('is_metal') == (cv_label == "metal") else "unknown",
                        "humidity_validation": "pass",  # Implement proper validation
                        "cnn_stage1_agreement": stage1_result["confidence"] > 0.5,
                        "cnn_stage2_agreement": stage2_result["confidence"] > 0.5 if stage2_result else True
                    }
                }
            else:
                return {
                    "final_classification": "unknown",
                    "confidence": 0.0,
                    "disposal_location": "Manual sorting required",
                    "reasoning": "Expert system could not determine classification",
                    "candidates_count": 0,
                    "processing_stage": "expert_system_failed"
                }
                
        except Exception as e:
            self.logger.error(f"Expert system integration failed: {e}")
            return self.create_fallback_result(stage1_result, stage2_result)

    def create_fallback_result(self, stage1_result: Dict, stage2_result: Optional[Dict]) -> Dict:
        """Create fallback result when expert system fails"""
        if stage2_result and stage2_result.get("confidence", 0) > stage1_result.get("confidence", 0):
            classification = stage2_result["predicted_class"]
            confidence = stage2_result["confidence"]
        else:
            classification = stage1_result["predicted_class"]
            confidence = stage1_result["confidence"]
        
        return {
            "final_classification": classification,
            "confidence": confidence,
            "disposal_location": self.get_disposal_location(classification),
            "reasoning": "Fallback to CNN prediction (expert system unavailable)",
            "candidates_count": 1,
            "processing_stage": "cnn_fallback"
        }

    async def capture_image(self) -> Optional[np.ndarray]:
        """Capture image from camera"""
        if not self.camera:
            # Return mock image for testing
            return np.random.randint(0, 255, (384, 384, 3), dtype=np.uint8)
        
        ret, frame = self.camera.read()
        if not ret:
            self.logger.error("Failed to capture frame from camera")
            return None
            
        return frame

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for model inference"""
        # Resize to model input size
        image = cv2.resize(image, (384, 384))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Normalize using ResNet50 preprocessing
        image = tf.keras.applications.resnet50.preprocess_input(image)
        image = np.expand_dims(image, axis=0)
        
        return image

    def get_disposal_location(self, classification: str) -> str:
        """Get disposal location for classification"""
        disposal_map = {
            'plastic': 'Plastic recycling bin',
            'PET_bottle': 'PET plastic recycling bin',
            'plastic_bag': 'Soft plastics collection',
            'container': 'Hard plastics bin', 
            'food_packaging': 'Mixed recycling (check contamination)',
            'metal': 'Metal recycling bin',
            'glass': 'Glass recycling bin',
            'paper': 'Paper recycling bin',
            'cardboard': 'Cardboard recycling bin',
        }
        return disposal_map.get(classification.lower(), 'General waste bin')

    async def send_classification_result(self, result: Dict):
        """Send complete classification result to backend"""
        try:
            success = await self.hub_client.send_message("SendClassificationResult", json.dumps(result))
            
            if success:
                self.logger.info(f"✅ Complete result sent: {result['expert_system_result']['final_classification']}")
            else:
                self.logger.error("❌ Failed to send classification result to backend")
                
        except Exception as e:
            self.logger.error(f"Error sending classification result: {e}")

    async def heartbeat_worker(self):
        """Send periodic heartbeat to backend"""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                heartbeat_data = {
                    "service_name": "enhanced_cnn_service",
                    "timestamp": datetime.now().isoformat(),
                    "status": "healthy",
                    "camera_connected": self.camera is not None and self.camera.isOpened() if self.camera else False,
                    "model_loaded": self.model is not None,
                    "expert_system_available": self.expert_system is not None,
                    "items_in_queue": self.processing_queue.qsize(),
                    "is_processing": self.is_processing
                }
                
                await self.hub_client.send_message("SendHeartbeat", json.dumps(heartbeat_data))
                
            except Exception as e:
                self.logger.error(f"Error sending heartbeat: {e}")

    def set_arduino_service(self, arduino_service):
        """Set Arduino service for sensor data integration"""
        self.arduino_service = arduino_service
        self.logger.info("✅ Arduino service integration enabled")

    async def cleanup(self):
        """Cleanup resources"""
        if self.camera:
            self.camera.release()
        await self.hub_client.disconnect()
        self.logger.info("🧹 Enhanced CNN service cleanup complete")


# Service entry point
async def start_enhanced_cnn_service():
    """Start the enhanced CNN service"""
    model_path = os.getenv('MODEL_PATH', '../models/trash_classifier_v3_93_accuracy_4mp.keras')
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:5099/hubs/classification')
    
    service = CNNService(model_path, backend_url)
    await service.start_service()

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    asyncio.run(start_enhanced_cnn_service())
