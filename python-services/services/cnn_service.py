"""
CNN Service with Image Capture and Storage using YOLOv8
Captures images, processes them through YOLO, gets a final decision from the
expert system, and sends complete results with images to the backend.
"""

import asyncio
import copy
import cv2
import numpy as np
from typing import Dict, Optional, Tuple
from datetime import datetime
import logging
import json
import sys
import os
from pathlib import Path
import base64
from PIL import Image
import io

# --- 1. Import your new YOLO service and the Hub Client ---
from .yolo_service import detect_relevant_objects, model as yolo_model
from .hub_client import SignalRHubClient

# --- 2. Add src to path to import expert system components ---
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

try:
    from smart_bin.core.knowledge_engine import SmartBinKnowledgeEngine
    from smart_bin.core.facts import WasteFact
except ImportError as e:
    logging.warning(f"Could not import expert system components: {e}")
    SmartBinKnowledgeEngine = None
    WasteFact = None

class CNNService:
    """Enhanced CNN Service using YOLOv8 for object detection."""
    
    def __init__(self, backend_hub_url: str = "http://localhost:5099/hubs/classification"):
        # Use the pre-loaded YOLO model directly from the yolo_service
        self.model = yolo_model
        self.camera = None
        self.hub_client = SignalRHubClient(backend_hub_url, "ClassificationHub")
        self.logger = logging.getLogger("CNNServiceWithYOLO")
        
        # Configuration
        self.expert_system = SmartBinKnowledgeEngine() if SmartBinKnowledgeEngine else None
        
        # Image capture configuration
        self.image_quality = int(os.getenv('IMAGE_QUALITY', '85'))
        self.max_image_width = int(os.getenv('MAX_IMAGE_WIDTH', '800'))
        self.max_image_height = int(os.getenv('MAX_IMAGE_HEIGHT', '600'))
        self.capture_format = os.getenv('IMAGE_FORMAT', 'JPEG')
        
        # Service integration & state
        self.arduino_service = None
        self.processing_queue = asyncio.Queue()
        self.is_processing = False
        
    async def start_service(self):
        """Start the CNN service with full orchestration."""
        self.logger.info("🚀 Starting Enhanced CNN Service with YOLOv8...")
        
        try:
            if not self.model:
                self.logger.error("YOLOv8 model failed to load. Aborting service start.")
                return

            if not await self.hub_client.connect():
                self.logger.error("Failed to connect to backend hub")
                return
                
            await self.hub_client.send_message("JoinClassificationGroup", "")
            await self.initialize_camera()
            
            await asyncio.gather(
                self.item_detection_worker(),
                self.classification_worker(),
                self.heartbeat_worker()
            )
            
        except Exception as e:
            self.logger.error(f"Failed to start CNN service: {e}", exc_info=True)
            raise

    async def initialize_camera(self):
        """Initialize camera for image capture."""
        try:
            camera_index = int(os.getenv('CAMERA_INDEX', '0'))
            self.logger.info(f"Initializing camera index {camera_index}...")
            
            self.camera = cv2.VideoCapture(camera_index)
            
            if not self.camera.isOpened():
                self.logger.warning("Failed to open camera, will use mock data.")
                self.camera = None
                return

            # Optional: Configure camera settings
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            
            # Warm up camera
            for _ in range(5):
                ret, _ = self.camera.read()
                if not ret: break
                    
            self.logger.info("✅ Camera initialized successfully")
            
        except Exception as e:
            self.logger.error(f"Camera initialization failed: {e}")
            self.camera = None

    async def item_detection_worker(self):
        """Worker that simulates item detection for testing."""
        # In the real system, this would be triggered by the ArduinoService.
        # This is a placeholder for standalone testing.
        self.logger.info("Starting item detection simulation worker...")
        while True:
            await asyncio.sleep(15) # Simulate a new item every 15 seconds
            if not self.is_processing:
                detection_id = f"item_{int(datetime.now().timestamp())}"
                item_data = {
                    "detection_id": detection_id,
                    "timestamp": datetime.now().isoformat(),
                    "trigger_source": "simulation"
                }
                await self.processing_queue.put(item_data)

    async def classification_worker(self):
        """Worker that processes items from the queue."""
        while True:
            item_data = await self.processing_queue.get()
            self.is_processing = True
            self.logger.info(f"🔄 Starting classification for {item_data['detection_id']}")
            
            result = await self.run_complete_pipeline_with_image(item_data)
            
            if result:
                await self.send_classification_result_with_image(result)
            else:
                self.logger.error(f"❌ Classification pipeline failed for {item_data['detection_id']}")
            
            self.is_processing = False
            self.processing_queue.task_done()

    async def run_complete_pipeline_with_image(self, item_data: Dict) -> Optional[Dict]:
        """The main pipeline for processing a single item."""
        detection_id = item_data["detection_id"]
        start_time = datetime.now()
        
        try:
            image_array, image_data = await self.capture_and_encode_image()
            if image_array is None: return None
            
            sensor_data = await self.get_sensor_data()
            yolo_result = await self.run_yolo_detection(image_array)
            expert_result = await self.run_expert_system_integration(yolo_result, sensor_data)
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            return {
                "detection_id": detection_id,
                "timestamp": item_data["timestamp"],
                "processing_time_ms": processing_time,
                "image_data": image_data,
                "cnn_prediction": yolo_result,
                "sensor_data": sensor_data,
                "expert_system_result": expert_result,
                "processing_metadata": { "pipeline_version": "yolo_v1.0" }
            }
        except Exception as e:
            self.logger.error(f"Error in complete pipeline: {e}", exc_info=True)
            return None

    async def capture_and_encode_image(self) -> Tuple[Optional[np.ndarray], Optional[Dict]]:
        """Captures an image and returns both the raw array and encoded data dict."""
        try:
            image_array = await self.capture_image()
            if image_array is None: return None, None
            
            image_for_encoding = image_array.copy()
            
            height, width = image_for_encoding.shape[:2]
            if width > self.max_image_width or height > self.max_image_height:
                ratio = min(self.max_image_width / width, self.max_image_height / height)
                new_size = (int(width * ratio), int(height * ratio))
                image_for_encoding = cv2.resize(image_for_encoding, new_size)
            
            image_rgb = cv2.cvtColor(image_for_encoding, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(image_rgb)
            
            buffer = io.BytesIO()
            pil_image.save(buffer, format=self.capture_format, quality=self.image_quality)
            image_bytes = buffer.getvalue()
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            final_height, final_width = image_for_encoding.shape[:2]
            image_data = {
                "image_base64": image_base64,
                "format": self.capture_format.lower(),
                "dimensions": f"{final_width}x{final_height}",
                "size_bytes": len(image_bytes),
                "capture_timestamp": datetime.now().isoformat(),
            }
            return image_array, image_data
        except Exception as e:
            self.logger.error(f"Error capturing and encoding image: {e}", exc_info=True)
            return None, None

    async def capture_image(self) -> Optional[np.ndarray]:
        """Captures a single frame from the camera or returns a mock image."""
        if self.camera is None or not self.camera.isOpened():
            mock_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            cv2.putText(mock_image, 'MOCK IMAGE', (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 3, (255, 255, 255), 5)
            self.logger.info("📷 Using mock image (camera not available)")
            return mock_image
        
        ret, frame = self.camera.read()
        if not ret:
            self.logger.error("Failed to capture frame from camera")
            return None
        return frame

    async def send_classification_result_with_image(self, result: Dict):
        """Sends the complete, final result to the C# backend via SignalR."""
        try:
            log_result = copy.deepcopy(result)
            if log_result.get("image_data"):
                log_result["image_data"]["image_base64"] = f"<base64 data of {log_result['image_data']['size_bytes']} bytes>"
            
            self.logger.info(f"📤 Sending final result to backend for detection ID: {result['detection_id']}")
            await self.hub_client.send_message("SendClassificationResult", json.dumps(result))
        except Exception as e:
            self.logger.error(f"Error sending classification result: {e}", exc_info=True)

    async def get_sensor_data(self) -> Dict:
        """Gets sensor data from Arduino service or provides mock data."""
        if self.arduino_service and self.arduino_service.is_connected:
            return await self.arduino_service.read_sensors()
        else:
            import random
            return { "weight_grams": random.uniform(5, 500), "is_metal": random.choice([True, False]), "is_moist": random.choice([True, False]), "is_transparent": random.choice([True, False]), "is_flexible": random.choice([True, False])}

    async def run_yolo_detection(self, image: np.ndarray) -> Dict:
        """Runs YOLOv8 and returns the best detection."""
        try:
            detections, _ = detect_relevant_objects(image)
            
            if not detections:
                return {"predicted_class": "unknown", "confidence": 0.0, "stage": 1}

            best_detection = max(detections, key=lambda d: d['confidence'])
            self.logger.info(f"YOLOv8 best detection: {best_detection['label']}@{best_detection['confidence']:.2f}")
            return {"predicted_class": best_detection['label'], "confidence": best_detection['confidence'], "stage": 1}
        except Exception as e:
            self.logger.error(f"Error during YOLOv8 detection: {e}", exc_info=True)
            return {"predicted_class": "error", "confidence": 0.0, "stage": 1}

    async def run_expert_system_integration(self, yolo_result: Dict, sensor_data: Dict) -> Dict:
        """Packages data, runs the expert system, and returns the final decision."""
        try:
            if not self.expert_system:
                return self.create_fallback_result(yolo_result)
            
            waste_fact = WasteFact(
                cv_label=yolo_result.get("predicted_class"),
                cv_confidence=yolo_result.get("confidence"),
                weight_grams=sensor_data.get("weight_grams"),
                is_metal=sensor_data.get("is_metal_detected"), # Note the key name from your sensor data
                is_moist=sensor_data.get("is_moist"),
                is_transparent=sensor_data.get("is_transparent"),
                is_flexible=sensor_data.get("is_flexible")
            )
            
            self.expert_system.reset()
            self.expert_system.declare(waste_fact)
            self.expert_system.run()
            
            decision = self.expert_system.get_final_decision()
            
            if not decision.final_classification:
                return self.create_fallback_result(yolo_result)

            final_class = decision.final_classification
            return {
                "final_classification": final_class.category.value,
                "confidence": final_class.confidence,
                "disposal_location": final_class.disposal_location,
                "reasoning": final_class.reasoning,
            }
        except Exception as e:
            self.logger.error(f"Error in expert system integration: {e}", exc_info=True)
            return self.create_fallback_result(yolo_result)

    def create_fallback_result(self, yolo_result: Dict) -> Dict:
        """Creates a fallback result if the expert system fails."""
        yolo_class = yolo_result.get("predicted_class", "unknown")
        return {
            "final_classification": "unknown",
            "confidence": yolo_result.get("confidence", 0.0),
            "disposal_location": "Manual Inspection Bin",
            "reasoning": f"Fallback: Expert system failed. YOLO saw '{yolo_class}'.",
        }

    def get_disposal_location(self, classification: str) -> str:
        # This logic should ideally be inside the expert system, but can be here too.
        disposal_map = {'plastic': 'Plastic Bin', 'metal': 'Metal Bin', 'glass': 'Glass Bin', 'paper': 'Paper Bin', 'cardboard': 'Cardboard Bin', 'organic': 'Organic Bin'}
        return disposal_map.get(classification.lower(), 'General Waste Bin')

    async def heartbeat_worker(self):
        """Sends a periodic heartbeat to the backend."""
        while True:
            await asyncio.sleep(30)
            try:
                heartbeat_data = {
                    "service_name": "cnn_service_yolo",
                    "status": "healthy" if self.model else "unhealthy",
                    "camera_connected": self.camera is not None and self.camera.isOpened() if self.camera else False,
                }
                await self.hub_client.send_message("SendHeartbeat", json.dumps(heartbeat_data))
            except Exception as e:
                self.logger.error(f"Error sending heartbeat: {e}")

    def set_arduino_service(self, arduino_service):
        """Allows the orchestrator to inject the Arduino service instance."""
        self.arduino_service = arduino_service
        self.logger.info("✅ Arduino service successfully integrated.")

    async def cleanup(self):
        """Cleans up resources like the camera and hub connection."""
        if self.camera:
            self.camera.release()
        await self.hub_client.disconnect()
        self.logger.info("🧹 CNN service cleanup complete.")