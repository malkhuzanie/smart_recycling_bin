# python-services/services/cnn_service.py (Final Integrated Version)

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
    """Orchestrates the visual detection (YOLO) and expert system logic."""
    
    def __init__(self, backend_hub_url: str):
        self.model = yolo_model
        self.camera = None
        self.hub_client = SignalRHubClient(backend_hub_url, "ClassificationHub")
        self.logger = logging.getLogger("CNNService")
        
        self.expert_system = SmartBinKnowledgeEngine() if SmartBinKnowledgeEngine else None
        
        # Image capture configuration
        self.image_quality = int(os.getenv('IMAGE_QUALITY', '85'))
        self.max_image_width = int(os.getenv('MAX_IMAGE_WIDTH', '800'))
        self.max_image_height = int(os.getenv('MAX_IMAGE_HEIGHT', '600'))
        self.capture_format = os.getenv('IMAGE_FORMAT', 'JPEG')
        
        # Service integration & state
        self.arduino_service = None # This will be injected by the orchestrator
        self.processing_queue = asyncio.Queue()
        self.is_processing = False
        
    async def start_service(self):
        """Starts the CNN service's main loops."""
        self.logger.info("🚀 Starting CNN Service with YOLOv8 integration...")
        
        try:
            if not self.model:
                self.logger.error("YOLOv8 model failed to load. Aborting service start.")
                return

            if not await self.hub_client.connect():
                self.logger.error("Failed to connect to backend hub")
                return
                
            await self.hub_client.send_message("JoinClassificationGroup", "")
            await self.initialize_camera()
            
            # This worker will process requests put into the queue
            asyncio.create_task(self.classification_worker())
            # This worker sends periodic health updates
            asyncio.create_task(self.heartbeat_worker())
            
        except Exception as e:
            self.logger.error(f"Failed to start CNN service: {e}", exc_info=True)
            raise

    def set_arduino_service(self, arduino_service):
        """Allows the orchestrator to inject the Arduino service instance."""
        self.arduino_service = arduino_service
        self.logger.info("✅ Arduino service successfully integrated into CNNService.")

    async def trigger_classification(self, item_data: Dict):
        """Public method called by other services (like ArduinoService) to start a job."""
        if self.is_processing:
            self.logger.warning(f"Already processing an item. Ignoring trigger for {item_data.get('detection_id')}")
            return
        await self.processing_queue.put(item_data)

    async def classification_worker(self):
        """Worker that processes items from the queue, one by one."""
        while True:
            item_data = await self.processing_queue.get()
            self.is_processing = True
            self.logger.info(f"🔄 Starting classification for {item_data.get('detection_id')}")
            
            result = await self.run_complete_pipeline_with_image(item_data)
            
            if result:
                await self.send_classification_result_with_image(result)
            else:
                self.logger.error(f"❌ Classification pipeline failed for {item_data.get('detection_id')}")
            
            self.is_processing = False
            self.processing_queue.task_done()

    async def run_complete_pipeline_with_image(self, item_data: Dict) -> Optional[Dict]:
        """The main pipeline for processing a single item."""
        detection_id = item_data.get("detection_id", f"item_{int(datetime.now().timestamp())}")
        start_time = datetime.now()
        
        try:
            # Step 1: Get data from all sources
            image_array, image_data = await self.capture_and_encode_image()
            if image_array is None: return None
            
            sensor_data = await self.get_sensor_data()
            yolo_result = self.run_yolo_detection(image_array) # This is now a synchronous call
            
            # Step 2: Get final decision from Expert System
            expert_result = self.run_expert_system_integration(yolo_result, sensor_data)
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Step 3: Compile the full result to send to backend
            complete_result = {
                "detection_id": detection_id,
                "timestamp": item_data.get("timestamp", datetime.now().isoformat()),
                "processing_time_ms": processing_time,
                "image_data": image_data,
                "cnn_prediction": yolo_result,
                "sensor_data": sensor_data,
                "expert_system_result": expert_result,
                "processing_metadata": { "pipeline_version": "yolo_v1.0" }
            }
            return complete_result
            
        except Exception as e:
            self.logger.error(f"Error in complete pipeline: {e}", exc_info=True)
            return None

    def run_yolo_detection(self, image: np.ndarray) -> Dict:
        """Runs YOLOv8 and returns the best detection."""
        try:
            detections, _ = detect_relevant_objects(image)
            
            if not detections:
                return {"predicted_class": "unknown", "confidence": 0.0, "stage": 1}

            best_detection = max(detections, key=lambda d: d['confidence'])
            self.logger.info(f"YOLOv8 detected: {best_detection['label']}@{best_detection['confidence']:.2f}")
            return {"predicted_class": best_detection['label'], "confidence": best_detection['confidence'], "stage": 1}
        except Exception as e:
            self.logger.error(f"Error during YOLOv8 detection: {e}", exc_info=True)
            return {"predicted_class": "error", "confidence": 0.0, "stage": 1}

    def run_expert_system_integration(self, yolo_result: Dict, sensor_data: Dict) -> Dict:
        """Packages data, runs the expert system, and returns the final decision."""
        if not self.expert_system:
            return self.create_fallback_result(yolo_result)
        
        try:
            # Create the WasteFact using all available data
            waste_fact = WasteFact(
                cv_label=yolo_result.get("predicted_class"),
                cv_confidence=yolo_result.get("confidence"),
                weight_grams=sensor_data.get("weight_grams"),
                is_metal=sensor_data.get("is_metal"),
                humidity_percent=sensor_data.get("humidity_percent"),
                ir_transparency=sensor_data.get("ir_transparency"),
                is_moist=sensor_data.get("is_moist"),
                is_transparent=sensor_data.get("is_transparent")
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

    async def get_sensor_data(self) -> Dict:
        """Gets sensor data from Arduino service or provides mock data if unavailable."""
        if self.arduino_service and self.arduino_service.is_connected:
            sensor_data = await self.arduino_service.read_sensors()
            if sensor_data:
                return sensor_data
        
        # Fallback to mock data if service unavailable or read fails
        self.logger.warning("Using mock sensor data.")
        import random
        return { "weight_grams": random.uniform(5, 500), "is_metal": random.choice([True, False]), "humidity_percent": random.uniform(20, 80), "ir_transparency": random.uniform(0.1, 0.9), "is_moist": random.choice([True, False]), "is_transparent": random.choice([True, False]) }

    # --- Utility and Helper Methods ---

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
                "image_base64": image_base64, "format": self.capture_format.lower(),
                "dimensions": f"{final_width}x{final_height}", "size_bytes": len(image_bytes),
                "capture_timestamp": datetime.now().isoformat(),
            }
            return image_array, image_data
        except Exception as e:
            self.logger.error(f"Error capturing and encoding image: {e}", exc_info=True)
            return None, None

    async def capture_image(self) -> Optional[np.ndarray]:
        """Captures a single frame from the camera or returns a mock image."""
        if self.camera and self.camera.isOpened():
            ret, frame = self.camera.read()
            if ret:
                return frame
            self.logger.error("Failed to capture frame from camera")
        
        mock_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        cv2.putText(mock_image, 'MOCK IMAGE', (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 3, (255, 255, 255), 5)
        self.logger.info("📷 Using mock image (camera not available or failed)")
        return mock_image

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

    async def heartbeat_worker(self):
        """Sends a periodic heartbeat to the backend."""
        while True:
            await asyncio.sleep(30)
            try:
                heartbeat_data = {
                    "service_name": "cnn_service_yolo", "status": "healthy" if self.model else "unhealthy",
                    "camera_connected": self.camera is not None and self.camera.isOpened()
                }
                await self.hub_client.send_message("SendHeartbeat", json.dumps(heartbeat_data))
            except Exception as e:
                self.logger.error(f"Error sending heartbeat: {e}")

    async def cleanup(self):
        """Cleans up resources like the camera and hub connection."""
        if self.camera:
            self.camera.release()
        await self.hub_client.disconnect()
        self.logger.info("🧹 CNN service cleanup complete.")