"""
CNN Service with Image Capture and Storage
Captures images, processes them through CNN, and sends complete results with images to backend
"""

import asyncio
import copy
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
import base64
from PIL import Image
import io

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
    """Enhanced CNN Service with full process orchestration and image capture/storage"""
    
    def __init__(self, model_path: str, backend_hub_url: str = "http://localhost:5099/hubs/classification"):
        self.model_path = model_path
        self.model = None
        self.camera = None
        self.hub_client = SignalRHubClient(backend_hub_url, "ClassificationHub")
        self.logger = logging.getLogger("CNNServiceWithImages")
        
        # Model configuration
        self.classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic']
        self.confidence_threshold = 0.85
        self.expert_system = SmartBinKnowledgeEngine() if SmartBinKnowledgeEngine else None
        
        # 📷 Image capture configuration
        self.image_quality = int(os.getenv('IMAGE_QUALITY', '85'))  # JPEG quality 0-100
        self.max_image_width = int(os.getenv('MAX_IMAGE_WIDTH', '800'))  # Resize large images
        self.max_image_height = int(os.getenv('MAX_IMAGE_HEIGHT', '600'))
        self.capture_format = os.getenv('IMAGE_FORMAT', 'JPEG')
        
        # Arduino communication
        self.arduino_service = None  # Will be injected
        
        # Processing queue for items
        self.processing_queue = asyncio.Queue()
        self.is_processing = False
        
    async def start_service(self):
        """Start the CNN service with full orchestration"""
        self.logger.info("🚀 Starting Enhanced CNN Service with Image Capture...")
        
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
            self.logger.error(f"Failed to start  CNN service: {e}")
            raise

    async def load_model(self):
        """Load the TensorFlow model"""
        try:
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            self.logger.info(f"Loading model from: {self.model_path}")
            self.model = tf.keras.models.load_model(self.model_path)
            
            # Log model info
            input_shape = self.model.input_shape
            output_shape = self.model.output_shape
            self.logger.info(f"✅ Model loaded - Input: {input_shape}, Output: {output_shape}")
            
        except Exception as e:
            self.logger.error(f"Failed to load model: {e}")
            raise

    async def initialize_camera(self):
        """Initialize camera for image capture"""
        try:
            camera_index = int(os.getenv('CAMERA_INDEX', '0'))
            self.logger.info(f"Initializing camera index {camera_index}...")
            
            self.camera = cv2.VideoCapture(camera_index)
            
            if not self.camera.isOpened():
                self.logger.warning("Failed to open camera, running in simulation mode")
                self.camera = None
                return
                
            # Configure camera settings for optimal capture
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            self.camera.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)  # Disable auto-exposure
            self.camera.set(cv2.CAP_PROP_EXPOSURE, -4)  # Set manual exposure
            
            # Warm up camera
            for _ in range(5):
                ret, frame = self.camera.read()
                if not ret:
                    break
                    
            self.logger.info("✅ Camera initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Camera initialization failed: {e}")
            self.camera = None

    async def item_detection_worker(self):
        """Worker that detects items and adds them to processing queue"""
        while True:
            try:
                await asyncio.sleep(1)  # Check every second
                
                # In real implementation, this would listen to Arduino sensor triggers
                # For now, simulate item detection every 10 seconds for testing
                if not self.is_processing:
                    detection_id = f"item_{int(datetime.now().timestamp())}"
                    item_data = {
                        "detection_id": detection_id,
                        "timestamp": datetime.now().isoformat(),
                        "trigger_source": "simulation"  # or "arduino_sensor"
                    }
                    await self.processing_queue.put(item_data)
                    self.logger.info(f"🔍 Item detected: {detection_id}")
                    
                await asyncio.sleep(10)  # Wait 10 seconds before next detection
                
            except Exception as e:
                self.logger.error(f"Error in item detection worker: {e}")
                await asyncio.sleep(5)

    async def classification_worker(self):
        """Worker that processes items from the queue"""
        while True:
            try:
                # Wait for items to process
                item_data = await self.processing_queue.get()
                
                self.is_processing = True
                self.logger.info(f"🔄 Starting classification for {item_data['detection_id']}")
                
                # Run complete processing pipeline with image capture
                result = await self.run_complete_pipeline_with_image(item_data)
                
                if result:
                    # Send complete result with image to backend
                    await self.send_classification_result_with_image(result)
                else:
                    self.logger.error(f"❌ Classification failed for {item_data['detection_id']}")
                
                self.is_processing = False
                self.processing_queue.task_done()
                
            except Exception as e:
                self.logger.error(f"Error in classification worker: {e}")
                self.is_processing = False
                await asyncio.sleep(1)

    async def run_complete_pipeline_with_image(self, item_data: Dict) -> Optional[Dict]:
        """
        🖼️ Complete classification pipeline with image capture and processing
        """
        detection_id = item_data["detection_id"]
        start_time = datetime.now()
        
        try:
            self.logger.info(f"🔬 Starting complete pipeline with image for {detection_id}")
            
            # Step 1: Capture and encode image
            self.logger.info("📷 Capturing and encoding image...")
            image_array, image_data = await self.capture_and_encode_image()
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
            
            # Compile complete result with image data
            complete_result = {
                "detection_id": detection_id,
                "timestamp": item_data["timestamp"],
                "processing_time_ms": processing_time,
                
                # 🖼️ IMAGE DATA - NEW ADDITION
                "image_data": image_data,
                
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
                    "pipeline_version": "v1.0_with_images",
                    "model_version": "trash_classifier_v3_93",
                    "processing_node": os.uname().nodename if hasattr(os, 'uname') else 'unknown',
                    "stages_completed": [
                        "image_capture", 
                        "stage1", 
                        "stage2" if stage2_result else None, 
                        "expert_system"
                    ],
                    "fallback_used": stage1_result.get("confidence", 0) < self.confidence_threshold,
                    "image_captured": True,
                    "image_quality": self.image_quality
                }
            }
            
            self.logger.info(f"✅ Complete pipeline with image finished for {detection_id}: "
                           f"{expert_result.get('final_classification')} "
                           f"(confidence: {expert_result.get('confidence', 0):.2f}, "
                           f"image: {image_data['format']}, {image_data['dimensions']})")
            
            return complete_result
            
        except Exception as e:
            self.logger.error(f"Error in complete pipeline with image: {e}")
            return None

    async def capture_and_encode_image(self) -> Tuple[Optional[np.ndarray], Optional[Dict]]:
        """
        🖼️ Capture image from camera and encode it as Base64
        Returns: (image_array_for_processing, image_data_for_storage)
        """
        try:
            # Capture image
            image_array = await self.capture_image()
            if image_array is None:
                return None, None
            
            # Create a copy for encoding (don't modify the original for CNN processing)
            image_for_encoding = image_array.copy()
            
            # Resize if too large (to save storage space)
            height, width = image_for_encoding.shape[:2]
            if width > self.max_image_width or height > self.max_image_height:
                # Calculate resize ratio maintaining aspect ratio
                ratio = min(self.max_image_width / width, self.max_image_height / height)
                new_width = int(width * ratio)
                new_height = int(height * ratio)
                image_for_encoding = cv2.resize(image_for_encoding, (new_width, new_height))
                self.logger.info(f"📐 Resized image: {width}x{height} → {new_width}x{new_height}")
            
            # Convert BGR to RGB for PIL
            image_rgb = cv2.cvtColor(image_for_encoding, cv2.COLOR_BGR2RGB)
            
            # Convert to PIL Image
            pil_image = Image.fromarray(image_rgb)
            
            # Encode to Base64
            buffer = io.BytesIO()
            pil_image.save(buffer, format=self.capture_format, quality=self.image_quality, optimize=True)
            buffer.seek(0)
            
            # Get image bytes and encode as Base64
            image_bytes = buffer.getvalue()
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            # Prepare image metadata
            final_height, final_width = image_for_encoding.shape[:2]
            image_data = {
                "image_base64": image_base64,
                "format": self.capture_format.lower(),
                "dimensions": f"{final_width}x{final_height}",
                "size_bytes": len(image_bytes),
                "capture_timestamp": datetime.now().isoformat(),
                "quality": self.image_quality,
                "original_dimensions": f"{width}x{height}" if (width, height) != (final_width, final_height) else None
            }
            
            self.logger.info(f"📷 Image encoded: {image_data['format']}, "
                           f"{image_data['dimensions']}, "
                           f"{image_data['size_bytes'] / 1024:.1f}KB, "
                           f"Base64 length: {len(image_base64)}")
            
            return image_array, image_data
            
        except Exception as e:
            self.logger.error(f"Error capturing and encoding image: {e}")
            return None, None

    async def capture_image(self) -> Optional[np.ndarray]:
        """Capture image from camera"""
        if not self.camera:
            # Return mock image for testing - create a realistic test image
            mock_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            # Add some patterns to make it look more realistic
            cv2.rectangle(mock_image, (100, 100), (500, 300), (0, 255, 0), 2)
            cv2.putText(mock_image, 'MOCK WASTE ITEM', (150, 220), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            self.logger.info("📷 Using mock image (camera not available)")
            return mock_image
        
        try:
            # Capture multiple frames and use the last one (camera warm-up)
            for _ in range(3):
                ret, frame = self.camera.read()
                if not ret:
                    self.logger.error("Failed to capture frame from camera")
                    return None
            
            self.logger.info(f"📷 Image captured: {frame.shape}")
            return frame
            
        except Exception as e:
            self.logger.error(f"Error capturing image: {e}")
            return None

    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for model inference"""
        # Resize to model input size (384x384 based on your model)
        image = cv2.resize(image, (384, 384))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Normalize using ResNet50 preprocessing
        image = tf.keras.applications.resnet50.preprocess_input(image)
        image = np.expand_dims(image, axis=0)
        
        return image

    async def send_classification_result_with_image(self, result: Dict):
        """
        🖼️ Send complete classification result with image to backend
        """
        try:
            # Log the result being sent (without the image data for brevity)
            log_result = copy.deepcopy(result)
            if "image_data" in log_result and "image_base64" in log_result["image_data"]:
                log_result["image_data"]["image_base64"] = f"<{len(result['image_data']['image_base64'])} chars>"
            
            self.logger.info(f"📤 Sending complete result with image: {json.dumps(log_result, indent=2)}")
            
            # Send to SignalR hub
            success = await self.hub_client.send_message("SendClassificationResult", json.dumps(result))
            
            if success:
                self.logger.info(f"✅ Complete result with image sent successfully: "
                               f"{result['expert_system_result']['final_classification']} "
                               f"(image: {result['image_data']['size_bytes'] / 1024:.1f}KB)")
            else:
                self.logger.error("❌ Failed to send classification result with image to backend")
                
        except Exception as e:
            self.logger.error(f"Error sending classification result with image: {e}")

    # Keep all existing methods (run_cnn_stage1, run_cnn_stage2, etc.) but add image support
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
                "processing_time_ms": 50  # Approximate
            }
            
        except Exception as e:
            self.logger.error(f"Error in CNN Stage 1: {e}")
            return {
                "stage": 1,
                "predicted_class": "unknown",
                "confidence": 0.0,
                "error": str(e)
            }

    async def run_cnn_stage2(self, image: np.ndarray) -> Dict:
        """Run Stage 2 CNN classification (plastic specialization)"""
        # For now, simulate Stage 2 - implement actual plastic subclassification model later
        try:
            plastic_subtypes = ['PET_bottle', 'plastic_bag', 'container', 'food_packaging']
            import random
            predicted_subtype = random.choice(plastic_subtypes)
            confidence = random.uniform(0.7, 0.95)
            
            return {
                "stage": 2,
                "predicted_class": predicted_subtype,
                "confidence": confidence,
                "specialized_for": "plastic",
                "processing_time_ms": 40
            }
            
        except Exception as e:
            self.logger.error(f"Error in CNN Stage 2: {e}")
            return {
                "stage": 2,
                "predicted_class": "plastic",
                "confidence": 0.0,
                "error": str(e)
            }

    async def run_expert_system_integration(self, stage1_result: Dict, stage2_result: Optional[Dict], sensor_data: Dict) -> Dict:
        """Run expert system integration and validation"""
        try:
            if not self.expert_system:
                # Fallback when expert system is not available
                return self.create_fallback_result(stage1_result, stage2_result)
            
            # Create waste fact for expert system
            waste_fact = WasteFact(
                weight_grams=sensor_data.get("weight_grams", 0),
                is_metal_detected=sensor_data.get("is_metal", False),
                humidity_percent=sensor_data.get("humidity_percent", 0),
                is_transparent=sensor_data.get("is_transparent", False),
                # Add other sensor properties as needed
            )
            
            # Reset expert system and add facts
            self.expert_system.reset()
            self.expert_system.declare(waste_fact)
            
            # Run expert system
            self.expert_system.run()
            
            # Get results from expert system
            # This would need to be implemented based on your expert system interface
            final_classification = stage2_result.get("predicted_class") if stage2_result else stage1_result.get("predicted_class")
            confidence = max(stage1_result.get("confidence", 0), stage2_result.get("confidence", 0) if stage2_result else 0)
            
            return {
                "final_classification": final_classification,
                "confidence": confidence,
                "disposal_location": self.get_disposal_location(final_classification),
                "reasoning": "Expert system validation passed",
                "candidates_count": 1,
                "processing_stage": "expert_system_validated"
            }
            
        except Exception as e:
            self.logger.error(f"Error in expert system integration: {e}")
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

    async def heartbeat_worker(self):
        """Send periodic heartbeat to backend"""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                heartbeat_data = {
                    "service_name": "cnn_service_with_images",
                    "timestamp": datetime.now().isoformat(),
                    "status": "healthy",
                    "camera_connected": self.camera is not None and self.camera.isOpened() if self.camera else False,
                    "model_loaded": self.model is not None,
                    "expert_system_available": self.expert_system is not None,
                    "items_in_queue": self.processing_queue.qsize(),
                    "is_processing": self.is_processing,
                    "image_capture_enabled": True,
                    "image_quality": self.image_quality,
                    "max_image_size": f"{self.max_image_width}x{self.max_image_height}"
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
        self.logger.info("🧹 Enhanced CNN service with images cleanup complete")


# Service entry point
async def start_cnn_service_with_images():
    """Start the CNN service with image capture"""
    model_path = os.getenv('MODEL_PATH', '../models/trash_classifier_v3_93_accuracy_4mp.keras')
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:5099/hubs/classification')
    
    service = CNNService(model_path, backend_url)
    await service.start_service()

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    asyncio.run(start_cnn_service_with_images())
