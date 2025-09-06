# python-services/services/arduino_service.py (Refactored Version)

import asyncio
import serial
import json
import logging
from datetime import datetime
from typing import Dict, Optional

from .hub_client import SignalRHubClient

class ArduinoService:
    """
    Service to manage communication with the Arduino board, monitor sensors,
    and trigger the classification pipeline.
    """
    
    def __init__(self, port: str, baudrate: int, backend_hub_url: str):
        self.port = port
        self.baudrate = baudrate
        self.serial_connection = None
        self.is_connected = False
        self.hub_client = SignalRHubClient(backend_hub_url, "ArduinoHub") # Separate hub name for clarity
        self.logger = logging.getLogger("ArduinoService")
        
        # --- Configuration ---
        self.weight_offset = 0.0
        self.item_detection_threshold_grams = 5.0 # Min weight to be considered an item
        self.last_weight = 0.0
        
        # --- Service Integration ---
        self.cnn_service = None # This will be injected by the orchestrator
        
        # --- State Management ---
        self.processing_state = "idle" # States: idle, item_present, processing

    async def start_service(self):
        """Starts the Arduino service's main loops."""
        self.logger.info("🚀 Starting Arduino Service...")
        try:
            await self.hub_client.connect()
            await self.connect_arduino()
            
            if self.is_connected:
                await self.calibrate_sensors()
            
            # Start the main monitoring loop
            asyncio.create_task(self.sensor_monitoring_worker())
            # Start a periodic heartbeat
            asyncio.create_task(self.heartbeat_worker())

        except Exception as e:
            self.logger.error(f"Failed to start Arduino service: {e}", exc_info=True)
            raise

    def set_cnn_service(self, cnn_service):
        """Allows the orchestrator to inject the CNN service instance."""
        self.cnn_service = cnn_service
        self.logger.info("✅ CNN service successfully integrated into ArduinoService.")

    async def connect_arduino(self) -> bool:
        """Establishes a connection with the Arduino board."""
        try:
            self.logger.info(f"Attempting to connect to Arduino on {self.port} at {self.baudrate} baud...")
            self.serial_connection = serial.Serial(self.port, self.baudrate, timeout=2)
            await asyncio.sleep(2) # Give Arduino time to reset after connection
            
            if self.serial_connection.is_open:
                self.is_connected = True
                self.logger.info(f"✅ Connected to Arduino on {self.port}")
                return True
        except serial.SerialException as e:
            self.logger.error(f"Serial connection to Arduino failed: {e}")
        
        self.is_connected = False
        self.logger.warning("Running in Arduino simulation mode.")
        return False

    async def sensor_monitoring_worker(self):
        """The main loop that continuously polls the Arduino for sensor data."""
        while True:
            try:
                sensor_data = await self.read_sensors()
                
                if sensor_data:
                    current_weight = sensor_data.get("weight_grams", 0)
                    
                    # State Machine Logic
                    if self.processing_state == "idle":
                        if current_weight > self.item_detection_threshold_grams:
                            await self.handle_item_detected(sensor_data)
                    
                    elif self.processing_state == "item_present":
                        # Item is waiting for removal
                        if current_weight < self.item_detection_threshold_grams:
                            await self.handle_item_removed()
                
                await asyncio.sleep(0.5) # Poll sensors twice per second
            except Exception as e:
                self.logger.error(f"Error in sensor monitoring loop: {e}", exc_info=True)
                await asyncio.sleep(5) # Wait longer after an error

    async def handle_item_detected(self, sensor_data: Dict):
        """Handles the logic when a new item is detected."""
        self.processing_state = "processing"
        detection_id = f"item_{int(datetime.now().timestamp())}"
        self.logger.info(f"📦 Item Detected! ID: {detection_id}, Weight: {sensor_data.get('weight_grams'):.2f}g")

        if self.cnn_service:
            self.logger.info(f"-> Triggering full classification pipeline in CNNService...")
            item_data = {"detection_id": detection_id, "timestamp": datetime.now().isoformat()}
            await self.cnn_service.trigger_classification(item_data)
        else:
            self.logger.warning("CNN service not available. Cannot trigger classification.")
            
        self.processing_state = "item_present" # Move to state waiting for removal

    async def handle_item_removed(self):
        """Handles the logic when an item is removed."""
        self.logger.info("✅ Item removed. System is idle and ready for next item.")
        self.processing_state = "idle"

    async def read_sensors(self) -> Optional[Dict]:
        """Sends a command to Arduino and reads the JSON response."""
        if not self.is_connected:
            return None # In production, we don't mock data here. CNNService will mock if needed.

        try:
            # Clear input buffer before writing to ensure we get a fresh response
            self.serial_connection.reset_input_buffer()
            # Send the command to the Arduino
            self.serial_connection.write(b'READ_SENSORS\n')
            
            # Read the response line
            response_line = self.serial_connection.readline()
            
            if not response_line:
                self.logger.warning("No data received from Arduino.")
                return None

            response_str = response_line.decode('utf-8').strip()
            raw_data = json.loads(response_str)
            
            return self.process_sensor_data(raw_data)
            
        except json.JSONDecodeError:
            self.logger.error(f"Invalid JSON received from Arduino: {response_str}")
            return None
        except Exception as e:
            self.logger.error(f"Failed to read from Arduino: {e}")
            self.is_connected = False # Assume connection is lost
            return None

    def process_sensor_data(self, raw_data: Dict) -> Dict:
        """Processes the raw JSON from Arduino into the final structured format."""
        weight = float(raw_data.get('weight', 0.0))
        humidity = float(raw_data.get('humidity', 0.0))

        return {
            "weight_grams": max(0, weight - self.weight_offset),
            "is_metal": bool(raw_data.get('metal_detected', False)),
            "humidity_percent": humidity,
            "ir_transparency": float(raw_data.get('ir_transparency', 0.0)),
            
            # Derived properties based on the sensor data
            "is_moist": humidity > 60.0,
            "is_transparent": float(raw_data.get('ir_transparency', 0.0)) > 0.7,
            "is_flexible": (weight < 50 and humidity < 30)
        }

    async def calibrate_sensors(self):
        """Calculates the tare weight of the scale."""
        self.logger.info("⚖️  Calibrating weight sensor (taring)...")
        weight_samples = []
        for _ in range(10):
            data = await self.read_sensors()
            if data:
                weight_samples.append(data.get('weight_grams', 0))
            await asyncio.sleep(0.1)
        
        if weight_samples:
            self.weight_offset = sum(weight_samples) / len(weight_samples)
            self.logger.info(f"✅ Weight sensor tare complete. Offset: {self.weight_offset:.2f}g")
        else:
            self.logger.error("❌ Calibration failed. Could not read from scale.")

    async def heartbeat_worker(self):
        """Sends a periodic heartbeat to the backend."""
        while True:
            await asyncio.sleep(30)
            try:
                heartbeat_data = {
                    "service_name": "arduino_service",
                    "status": "healthy" if self.is_connected else "degraded",
                    "arduino_connected": self.is_connected,
                    "processing_state": self.processing_state,
                }
                await self.hub_client.send_message("SendHeartbeat", json.dumps(heartbeat_data))
            except Exception as e:
                self.logger.error(f"Error sending Arduino heartbeat: {e}")

    async def cleanup(self):
        """Cleans up resources."""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.close()
        await self.hub_client.disconnect()
        self.logger.info("🧹 Arduino service cleanup complete.")