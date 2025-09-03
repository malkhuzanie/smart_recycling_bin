"""
Arduino Service with Enhanced Integration
Coordinates with CNN service for full pipeline processing
"""

import asyncio
import serial
import json
import logging
from datetime import datetime
from typing import Dict, Optional, List, Callable

from .hub_client import SignalRHubClient

class ArduinoService:
    """Arduino Service with CNN service coordination"""
    
    def __init__(self, port: str = '/dev/ttyUSB0', baudrate: int = 9600, 
                 backend_hub_url: str = "http://localhost:5099/hubs/classification"):
        self.port = port
        self.baudrate = baudrate
        self.serial_connection = None
        self.is_connected = False
        self.hub_client = SignalRHubClient(backend_hub_url, "ClassificationHub")
        self.logger = logging.getLogger("ArduinoService")
        
        # Calibration values
        self.weight_offset = 0.0
        self.last_weight = 0.0
        self.item_detection_threshold = 5.0  # grams
        
        # CNN service integration
        self.cnn_service = None  # Will be injected
        self.classification_callback = None
        
        # State management
        self.current_item_id = None
        self.processing_state = "idle"  # idle, detecting, processing, waiting_removal
        
    async def start_service(self):
        """Start the Arduino service"""
        self.logger.info("🚀 Starting Arduino Service...")
        
        try:
            # Connect to SignalR hub
            if not await self.hub_client.connect():
                self.logger.error("Failed to connect to backend hub")
                return
                
            # Join classification group
            await self.hub_client.send_message("JoinClassificationGroup", "")
                
            # Connect to Arduino
            if not await self.connect_arduino():
                self.logger.warning("Failed to connect to Arduino, running in simulation mode")
                
            # Start monitoring workers
            await asyncio.gather(
                self.sensor_monitoring_worker(),
                self.state_management_worker(),
                self.heartbeat_worker()
            )
            
        except Exception as e:
            self.logger.error(f"Failed to start Arduino service: {e}")
            raise
    
    async def connect_arduino(self) -> bool:
        """Connect to Arduino"""
        try:
            self.logger.info(f"Connecting to Arduino on {self.port} at {self.baudrate} baud...")
            
            self.serial_connection = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=2
            )
            
            # Wait for Arduino to initialize
            await asyncio.sleep(3)
            
            # Test connection by reading initial sensor state
            test_reading = await self.read_sensors()
            if test_reading:
                self.is_connected = True
                self.logger.info(f"✅ Connected to Arduino on {self.port}")
                
                # Calibrate sensors
                await self.calibrate_sensors()
                return True
                
        except serial.SerialException as e:
            self.logger.error(f"Serial connection failed: {e}")
        except Exception as e:
            self.logger.error(f"Failed to connect to Arduino: {e}")
            
        self.is_connected = False
        return False
    
    async def sensor_monitoring_worker(self):
        """Worker that continuously monitors sensors"""
        self.logger.info("🔄 Sensor monitoring worker started")
        
        while True:
            try:
                # Ensure hub connection
                await self.hub_client.ensure_connection()
                
                # Read sensor data
                sensor_data = await self.read_sensors()
                
                if sensor_data:
                    await self.process_sensor_reading(sensor_data)
                
                # Monitor at 2Hz (500ms intervals)
                await asyncio.sleep(0.5)
                
            except KeyboardInterrupt:
                self.logger.info("🛑 Shutting down Arduino service...")
                break
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(1)

    async def process_sensor_reading(self, sensor_data: Dict):
        """Process sensor reading and manage item detection state"""
        current_weight = sensor_data["weight_grams"]
        
        if self.processing_state == "idle":
            # Check for new item detection
            if self.detect_item_placement(current_weight):
                await self.handle_item_detected(sensor_data)
                
        elif self.processing_state == "processing":
            # Item is being processed, continue monitoring
            pass
            
        elif self.processing_state == "waiting_removal":
            # Check for item removal
            if self.detect_item_removal(current_weight):
                await self.handle_item_removed()
        
        self.last_weight = current_weight

    async def handle_item_detected(self, sensor_data: Dict):
        """Handle new item detection"""
        self.processing_state = "processing"
        self.current_item_id = f"item_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        self.logger.info(f"📦 Item detected: {self.current_item_id}")
        self.logger.info(f"   Weight: {sensor_data['weight_grams']:.1f}g")
        self.logger.info(f"   Metal: {sensor_data['is_metal']}")
        self.logger.info(f"   Moist: {sensor_data['is_moist']}")
        
        # Send item detection alert to backend
        detection_alert = {
            "type": "item_detected",
            "item_id": self.current_item_id,
            "sensor_data": sensor_data,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.hub_client.send_message("NotifyItemDetection", json.dumps(detection_alert))
        
        # If CNN service is integrated, trigger full classification
        if self.cnn_service:
            try:
                await self.trigger_full_classification(sensor_data)
            except Exception as e:
                self.logger.error(f"Failed to trigger CNN classification: {e}")
                self.processing_state = "waiting_removal"
        else:
            # Fallback: send sensor-only classification
            await self.send_sensor_only_classification(sensor_data)
            self.processing_state = "waiting_removal"

    async def trigger_full_classification(self, sensor_data: Dict):
        """Trigger full classification pipeline through CNN service"""
        try:
            classification_request = {
                "detection_id": self.current_item_id,
                "timestamp": datetime.now().isoformat(),
                "trigger_source": "arduino_sensor",
                "sensor_data": sensor_data,
                "request_full_pipeline": True
            }
            
            # If we have a direct reference to CNN service, call it
            if hasattr(self.cnn_service, 'process_complete_pipeline'):
                result = await self.cnn_service.process_complete_pipeline(classification_request)
                if result:
                    self.logger.info(f"✅ Full pipeline completed: {result['expert_system_result']['final_classification']}")
            
            # If we have a callback, use it
            elif self.classification_callback:
                await self.classification_callback(classification_request)
            
            self.processing_state = "waiting_removal"
            
        except Exception as e:
            self.logger.error(f"Error triggering full classification: {e}")
            self.processing_state = "waiting_removal"

    async def send_sensor_only_classification(self, sensor_data: Dict):
        """Send sensor-only classification when CNN is not available"""
        try:
            # Basic sensor-based classification
            classification = self.classify_by_sensors(sensor_data)
            
            sensor_result = {
                "detection_id": self.current_item_id,
                "timestamp": datetime.now().isoformat(),
                "processing_time_ms": 50,  # Sensor processing is fast
                
                "sensor_data": sensor_data,
                
                "expert_system_result": {
                    "final_classification": classification["material"],
                    "confidence": classification["confidence"],
                    "disposal_location": classification["disposal_location"],
                    "reasoning": "Sensor-only classification (CNN unavailable)",
                    "processing_stage": "sensor_fallback"
                },
                
                "processing_metadata": {
                    "pipeline_version": "sensor_only_v1.0",
                    "processing_node": "arduino_service",
                    "fallback_used": True,
                    "cnn_available": False
                }
            }
            
            await self.hub_client.send_message("SendClassificationResult", json.dumps(sensor_result))
            self.logger.info(f"✅ Sensor-only classification sent: {classification['material']}")
            
        except Exception as e:
            self.logger.error(f"Error sending sensor-only classification: {e}")

    def classify_by_sensors(self, sensor_data: Dict) -> Dict:
        """Basic sensor-only classification logic"""
        weight = sensor_data.get("weight_grams", 0)
        is_metal = sensor_data.get("is_metal", False)
        is_moist = sensor_data.get("is_moist", False)
        humidity = sensor_data.get("humidity_percent", 0)
        
        # Simple rule-based classification
        if is_metal:
            return {
                "material": "metal",
                "confidence": 0.95,
                "disposal_location": "Metal recycling bin"
            }
        elif is_moist or humidity > 60:
            return {
                "material": "organic",
                "confidence": 0.80,
                "disposal_location": "Organic waste bin"
            }
        elif weight > 100:  # Heavy items likely glass or thick plastic
            return {
                "material": "glass",
                "confidence": 0.60,
                "disposal_location": "Glass recycling bin"
            }
        elif weight < 20:  # Light items likely paper or plastic bags
            return {
                "material": "paper",
                "confidence": 0.50,
                "disposal_location": "Paper recycling bin"
            }
        else:
            return {
                "material": "plastic",
                "confidence": 0.40,
                "disposal_location": "Plastic recycling bin"
            }

    async def handle_item_removed(self):
        """Handle item removal detection"""
        self.logger.info(f"✅ Item removed: {self.current_item_id}")
        
        # Send removal notification
        removal_alert = {
            "type": "item_removed", 
            "item_id": self.current_item_id,
            "timestamp": datetime.now().isoformat()
        }
        
        await self.hub_client.send_message("ItemRemoved", json.dumps(removal_alert))
        
        # Reset state
        self.current_item_id = None
        self.processing_state = "idle"

    async def state_management_worker(self):
        """Worker that manages processing state and timeouts"""
        while True:
            try:
                await asyncio.sleep(1)  # Check every second
                
                # Handle processing timeout
                if self.processing_state == "processing":
                    # Add timeout logic here if needed
                    pass
                
                # Handle removal timeout  
                elif self.processing_state == "waiting_removal":
                    # Could add auto-reset after timeout
                    pass
                    
            except KeyboardInterrupt:
                break
            except Exception as e:
                self.logger.error(f"Error in state management worker: {e}")

    def _read_from_serial(self) -> Optional[str]:
        """Helper function with the blocking serial code."""
        if self.serial_connection and self.serial_connection.in_waiting > 0:
            return self.serial_connection.readline().decode('utf-8').strip()
        return None

    async def read_sensors(self) -> Optional[Dict]:
        """Read sensor data from Arduino"""
        if not self.is_connected or not self.serial_connection:
            # Return mock data for testing
            return self.generate_mock_sensor_data()
        
        try:
            # Send read command to Arduino
            await asyncio.to_thread(self.serial_connection.write, b'READ_SENSORS\n')
            # self.serial_connection.write(b'READ_SENSORS\n')
            await asyncio.sleep(0.1)  # Give Arduino time to respond
            
            # Read response
            if self.serial_connection.in_waiting > 0:
                response = await asyncio.to_thread(self._read_from_serial)
                # response = self.serial_connection.readline().decode('utf-8').strip()
                
                if response:
                    # Parse JSON response from Arduino
                    sensor_data = json.loads(response)
                    return self.process_sensor_data(sensor_data)
            
            return None
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON from Arduino: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Error reading sensors: {e}")
            self.is_connected = False
            return None

    def process_sensor_data(self, raw_data: Dict) -> Dict:
        """Process raw sensor data into structured format"""
        try:
            processed_data = {
                "timestamp": datetime.now().isoformat(),
                "weight_grams": max(0, float(raw_data.get('weight', 0)) - self.weight_offset),
                "is_metal": bool(raw_data.get('metal_detected', False)),
                "humidity_percent": float(raw_data.get('humidity', 0)),
                "temperature_celsius": float(raw_data.get('temperature', 20)),
                
                # Derived properties
                "is_moist": float(raw_data.get('humidity', 0)) > 60.0,
                "is_transparent": raw_data.get('ir_transparency', 0) > 0.7,
                "is_flexible": (float(raw_data.get('weight', 0)) < 50 and 
                              float(raw_data.get('humidity', 0)) < 30),
                "ir_transparency": raw_data.get('ir_transparency', 0),
                
                # Include raw data for debugging
                "raw_sensor_data": raw_data
            }
            
            return processed_data
            
        except Exception as e:
            self.logger.error(f"Error processing sensor data: {e}")
            return self.generate_mock_sensor_data()

    def generate_mock_sensor_data(self) -> Dict:
        """Generate mock sensor data for testing"""
        import random
        
        # Generate realistic mock data
        weight = random.uniform(5, 500)  # 5g to 500g
        is_metal = random.choice([True, False])
        humidity = random.uniform(20, 80)
        
        return {
            "timestamp": datetime.now().isoformat(),
            "weight_grams": weight,
            "is_metal": is_metal,
            "humidity_percent": humidity,
            "temperature_celsius": random.uniform(18, 25),
            "is_moist": humidity > 60,
            "is_transparent": random.choice([True, False]),
            "is_flexible": weight < 50,  # Light items tend to be flexible
            "ir_transparency": random.uniform(0.3, 0.9),
            "raw_sensor_data": {
                "weight": weight,
                "metal_detected": is_metal,
                "humidity": humidity,
                "temperature": random.uniform(18, 25),
                "ir_transparency": random.uniform(0.3, 0.9)
            }
        }

    def detect_item_placement(self, current_weight: float) -> bool:
        """Detect if an item has been placed on the sensor"""
        weight_change = abs(current_weight - self.last_weight)
        
        # Item detected if weight increases significantly
        if (current_weight > self.item_detection_threshold and 
            weight_change > self.item_detection_threshold):
            return True
            
        return False
    
    def detect_item_removal(self, current_weight: float) -> bool:
        """Detect if an item has been removed from the sensor"""
        return current_weight < self.item_detection_threshold

    async def calibrate_sensors(self) -> bool:
        """Calibrate Arduino sensors (zero the weight sensor)"""
        if not self.is_connected:
            self.logger.warning("Cannot calibrate - Arduino not connected")
            return False
        
        try:
            self.logger.info("🔧 Calibrating sensors...")
            
            # Read several weight samples to establish baseline
            weight_samples = []
            for _ in range(10):
                sensor_data = await self.read_sensors()
                if sensor_data:
                    weight_samples.append(sensor_data.get('weight_grams', 0))
                await asyncio.sleep(0.1)
            
            if weight_samples:
                self.weight_offset = sum(weight_samples) / len(weight_samples)
                self.logger.info(f"✅ Weight sensor calibrated (offset: {self.weight_offset:.2f}g)")
                return True
            else:
                self.logger.error("❌ Calibration failed - no sensor readings")
                return False
                
        except Exception as e:
            self.logger.error(f"❌ Calibration error: {e}")
            return False

    async def heartbeat_worker(self):
        """Send periodic heartbeat to backend"""
        while True:
            try:
                await asyncio.sleep(30)  # Every 30 seconds
                
                heartbeat_data = {
                    "service_name": "arduino_service",
                    "timestamp": datetime.now().isoformat(),
                    "status": "healthy",
                    "arduino_connected": self.is_connected,
                    "processing_state": self.processing_state,
                    "current_item_id": self.current_item_id,
                    "cnn_service_integrated": self.cnn_service is not None
                }
                
                await self.hub_client.send_message("SendHeartbeat", json.dumps(heartbeat_data))
                
            except Exception as e:
                self.logger.error(f"Error sending heartbeat: {e}")

    def set_cnn_service(self, cnn_service):
        """Set CNN service for full pipeline integration"""
        self.cnn_service = cnn_service
        self.logger.info("✅ CNN service integration enabled")

    def set_classification_callback(self, callback: Callable):
        """Set callback for classification trigger"""
        self.classification_callback = callback
        self.logger.info("✅ Classification callback set")

    async def cleanup(self):
        """Cleanup resources"""
        if self.serial_connection:
            try:
                self.serial_connection.close()
            except:
                pass
            self.is_connected = False
            
        await self.hub_client.disconnect()
        self.logger.info("Arduino service cleanup complete")


# Service entry point
async def start_arduino_service():
    """Start the Arduino service"""
    port = os.getenv('ARDUINO_PORT', '/dev/ttyUSB0')
    baudrate = int(os.getenv('ARDUINO_BAUDRATE', '9600'))
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:5099/hubs/classification')
    
    service = ArduinoService(port, baudrate, backend_url)
    await service.start_service()

if __name__ == "__main__":
    import os
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    asyncio.run(start_arduino_service())
