"""
Main Orchestrated Service Integration
Coordinates CNN, Arduino, and Expert System with Backend
Now includes HTTP health endpoints for backend monitoring
"""

import asyncio
import logging
import sys
from pathlib import Path

# Setup comprehensive logging FIRST
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "orchestrated_services.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)

# Silence overly verbose libraries
logging.getLogger("websockets").setLevel(logging.WARNING)
logging.getLogger("tensorflow").setLevel(logging.WARNING)

logger = logging.getLogger("OrchestratedServices")

import sys
import os
from pathlib import Path
import signal
from aiohttp import web, ClientSession
import json
from datetime import datetime
import threading
import time

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from services.cnn_service import CNNService
from services.arduino_service import ArduinoService

# Setup comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/orchestrated_services.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("OrchestratedServices")

class HealthService:
    """HTTP Health Service for backend monitoring"""
    
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        self.start_time = datetime.utcnow()
        
    async def health_check(self, request):
        """Main health check endpoint"""
        try:
            # Get service health status
            cnn_healthy = (
                hasattr(self.orchestrator.services, 'cnn') and 
                self.orchestrator.services.get('cnn') is not None and
                getattr(self.orchestrator.services.get('cnn'), 'model', None) is not None
            )
            
            arduino_healthy = (
                hasattr(self.orchestrator.services, 'arduino') and 
                self.orchestrator.services.get('arduino') is not None
            )
            
            # Calculate uptime
            uptime_seconds = (datetime.utcnow() - self.start_time).total_seconds()
            
            health_data = {
                "status": "healthy" if (cnn_healthy and arduino_healthy) else "degraded",
                "timestamp": datetime.utcnow().isoformat(),
                "services": {
                    "cnn_service": {
                        "healthy": cnn_healthy,
                        "model_loaded": cnn_healthy,
                        "last_check": datetime.utcnow().isoformat()
                    },
                    "arduino_service": {
                        "healthy": arduino_healthy,
                        "connected": arduino_healthy,
                        "last_check": datetime.utcnow().isoformat()
                    }
                },
                "metrics": {
                    "uptime_seconds": uptime_seconds,
                    "uptime_minutes": uptime_seconds / 60,
                    "is_processing": getattr(self.orchestrator, 'is_running', False)
                },
                "version": "1.0.0"
            }
            
            return web.json_response(health_data, status=200)
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return web.json_response({
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }, status=503)
    
    async def cnn_health(self, request):
        """CNN-specific health check"""
        try:
            cnn_service = self.orchestrator.services.get('cnn')
            if not cnn_service:
                return web.json_response({"status": "service_not_found"}, status=503)
            
            health_data = {
                "status": "healthy" if cnn_service.model is not None else "unhealthy",
                "model_loaded": cnn_service.model is not None,
                "camera_available": getattr(cnn_service, 'camera', None) is not None,
                "hub_connected": getattr(cnn_service.hub_client, 'is_connected', False),
                "processing": getattr(cnn_service, 'is_processing', False),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return web.json_response(health_data, status=200)
            
        except Exception as e:
            return web.json_response({
                "status": "error",
                "error": str(e)
            }, status=503)
    
    async def arduino_health(self, request):
        """Arduino-specific health check"""
        try:
            arduino_service = self.orchestrator.services.get('arduino')
            if not arduino_service:
                return web.json_response({"status": "service_not_found"}, status=503)
            
            health_data = {
                "status": "healthy" if getattr(arduino_service, 'is_connected', False) else "unhealthy",
                "arduino_connected": getattr(arduino_service, 'is_connected', False),
                "hub_connected": getattr(arduino_service.hub_client, 'is_connected', False),
                "port": getattr(arduino_service, 'port', 'unknown'),
                "baudrate": getattr(arduino_service, 'baudrate', 'unknown'),
                "timestamp": datetime.utcnow().isoformat()
            }
            
            return web.json_response(health_data, status=200)
            
        except Exception as e:
            return web.json_response({
                "status": "error",
                "error": str(e)
            }, status=503)

class SmartRecyclingBinOrchestrator:
    """Main orchestrator that coordinates all services"""
    
    def __init__(self):
        self.logger = logging.getLogger("Orchestrator")
        self.services = {}
        self.is_running = False
        self.health_service = HealthService(self)
        
        # Configuration from environment
        self.config = {
            'model_path': os.getenv('MODEL_PATH', '../models/trash_classifier_v3_93_accuracy_4mp.keras'),
            'arduino_port': os.getenv('ARDUINO_PORT', '/dev/ttyUSB0'),
            'arduino_baudrate': int(os.getenv('ARDUINO_BAUDRATE', '9600')),
            'backend_hub_url': os.getenv('BACKEND_URL', 'http://localhost:5099/hubs/classification'),
            'camera_index': int(os.getenv('CAMERA_INDEX', '0')),
            'health_port_cnn': int(os.getenv('CNN_HEALTH_PORT', '8001')),
            'health_port_arduino': int(os.getenv('ARDUINO_HEALTH_PORT', '8002'))
        }
    
    async def setup_health_servers(self):
        """Setup HTTP health check servers"""
        self.logger.info("🏥 Setting up health check servers...")
        
        # CNN Service Health Server (port 8001)
        cnn_app = web.Application()
        cnn_app.router.add_get('/health', self.health_service.health_check)
        cnn_app.router.add_get('/status', self.health_service.cnn_health)
        
        # Arduino Service Health Server (port 8002) 
        arduino_app = web.Application()
        arduino_app.router.add_get('/health', self.health_service.health_check)
        arduino_app.router.add_get('/status', self.health_service.arduino_health)
        
        # Start health servers
        cnn_runner = web.AppRunner(cnn_app)
        arduino_runner = web.AppRunner(arduino_app)
        
        await cnn_runner.setup()
        await arduino_runner.setup()
        
        cnn_site = web.TCPSite(cnn_runner, 'localhost', self.config['health_port_cnn'])
        arduino_site = web.TCPSite(arduino_runner, 'localhost', self.config['health_port_arduino'])
        
        await cnn_site.start()
        await arduino_site.start()
        
        self.logger.info(f"✅ CNN Health Server: http://localhost:{self.config['health_port_cnn']}/health")
        self.logger.info(f"✅ Arduino Health Server: http://localhost:{self.config['health_port_arduino']}/health")
        
        # Store runners for cleanup
        self.health_runners = [cnn_runner, arduino_runner]
        
    async def start_services(self):
        """Start and coordinate all services"""
        self.logger.info("🚀 Starting Smart Recycling Bin Orchestrated Services...")
        self.logger.info("=" * 80)
        
        try:
            # Log configuration
            self.logger.info("📋 Configuration:")
            for key, value in self.config.items():
                self.logger.info(f"   {key}: {value}")
            self.logger.info("=" * 80)
            
            # Setup health servers FIRST
            await self.setup_health_servers()
            
            # Check prerequisites
            if not await self.check_prerequisites():
                self.logger.error("❌ Prerequisites check failed")
                return False
            
            # Initialize services
            await self.initialize_services()
            
            # Setup service integration
            await self.setup_service_integration()
            
            # Start all services
            await self.start_all_services()
            
            self.is_running = True
            self.logger.info("✅ All services started successfully!")
            self.logger.info("🎯 Smart Recycling Bin is operational and ready for items")
            self.logger.info("=" * 80)
            
            return True
            
        except Exception as e:
            self.logger.error(f"💥 Failed to start services: {e}")
            return False

    async def check_prerequisites(self) -> bool:
        """Check if all prerequisites are met"""
        self.logger.info("🔍 Checking prerequisites...")
        
        # Check if model file exists
        if not os.path.exists(self.config['model_path']):
            self.logger.error(f"❌ Model file not found: {self.config['model_path']}")
            self.logger.error("📋 Please add your trained model to the models/ directory")
            return False
        
        # Check if backend is accessible (optional warning)
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f"http://localhost:5099/health", timeout=5) as response:
                    if response.status == 200:
                        self.logger.info("✅ Backend health check passed")
                    else:
                        self.logger.warning("⚠️  Backend may not be fully ready")
        except Exception as e:
            self.logger.warning(f"⚠️  Backend connection check failed: {e}")
            self.logger.info("🏢 Make sure the C# backend is running: cd backend && dotnet run")
        
        # Check camera access
        try:
            import cv2
            camera = cv2.VideoCapture(self.config['camera_index'])
            if camera.isOpened():
                self.logger.info("✅ Camera access verified")
                camera.release()
            else:
                self.logger.warning(f"⚠️  Camera {self.config['camera_index']} not accessible - will use mock data")
        except Exception as e:
            self.logger.warning(f"⚠️  Camera check failed: {e}")
        
        # Check Arduino port
        try:
            import serial
            ser = serial.Serial(self.config['arduino_port'], self.config['arduino_baudrate'], timeout=1)
            self.logger.info(f"✅ Arduino port {self.config['arduino_port']} accessible")
            ser.close()
        except Exception as e:
            self.logger.warning(f"⚠️  Arduino port {self.config['arduino_port']} not accessible - will use mock data")
        
        self.logger.info("✅ Prerequisites check completed")
        return True

    async def initialize_services(self):
        """Initialize all services"""
        self.logger.info("🔧 Initializing services...")
        
        # Initialize CNN Service
        self.services['cnn'] = CNNService(
            self.config['model_path'],
            self.config['backend_hub_url']
        )
        self.logger.info("✅ CNN Service initialized")
        
        # Initialize Arduino Service
        self.services['arduino'] = ArduinoService(
            self.config['arduino_port'],
            self.config['arduino_baudrate'],
            self.config['backend_hub_url']
        )
        self.logger.info("✅ Arduino Service initialized")
        
    async def setup_service_integration(self):
        """Setup integration between services"""
        self.logger.info("🔗 Setting up service integration...")
        
        # Integrate Arduino with CNN service
        self.services['arduino'].set_cnn_service(self.services['cnn'])
        self.services['cnn'].set_arduino_service(self.services['arduino'])
        
        # Set up communication callbacks
        self.services['arduino'].set_classification_callback(self.handle_classification_trigger)
        
        self.logger.info("✅ Service integration complete")

    async def handle_classification_trigger(self, trigger_data: dict):
        """Handle classification trigger from Arduino service"""
        try:
            self.logger.info(f"🎯 Classification triggered: {trigger_data['detection_id']}")
            
            # This is called when Arduino detects an item and CNN service is not directly integrated
            # Could be used for additional coordination logic
            
            # Example: Add custom pre-processing or validation here
            
        except Exception as e:
            self.logger.error(f"Error handling classification trigger: {e}")

    async def start_all_services(self):
        """Start all services concurrently"""
        self.logger.info("▶️  Starting all services...")
        
        # Create service tasks
        tasks = [
            asyncio.create_task(self.services['cnn'].start_service(), name="CNN-Service"),
            asyncio.create_task(self.services['arduino'].start_service(), name="Arduino-Service")
        ]
        
        # Add monitoring task
        tasks.append(asyncio.create_task(self.monitor_services(), name="Service-Monitor"))
        
        # Store tasks for cleanup
        self.service_tasks = tasks
        
        self.logger.info("✅ All service tasks created")

    async def monitor_services(self):
        """Monitor service health and status"""
        self.logger.info("👁️  Service monitor started")
        
        while self.is_running:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                # Log service status
                self.logger.info("📊 Service Status Report:")
                
                # CNN Service status
                cnn_status = {
                    'model_loaded': self.services['cnn'].model is not None,
                    'camera_connected': self.services['cnn'].camera is not None,
                    'hub_connected': self.services['cnn'].hub_client.is_connected,
                    'processing': self.services['cnn'].is_processing
                }
                self.logger.info(f"   🧠 CNN Service: {cnn_status}")
                
                # Arduino Service status
                arduino_status = {
                    'arduino_connected': self.services['arduino'].is_connected,
                    'hub_connected': self.services['arduino'].hub_client.is_connected,
                    'processing_state': self.services['arduino'].processing_state,
                    'current_item': self.services['arduino'].current_item_id
                }
                self.logger.info(f"   🔧 Arduino Service: {arduino_status}")
                
                # Check for any failed connections and attempt recovery
                if not self.services['cnn'].hub_client.is_connected:
                    self.logger.warning("⚠️  CNN Service hub disconnected, attempting reconnect...")
                    await self.services['cnn'].hub_client.ensure_connection()
                
                if not self.services['arduino'].hub_client.is_connected:
                    self.logger.warning("⚠️  Arduino Service hub disconnected, attempting reconnect...")
                    await self.services['arduino'].hub_client.ensure_connection()
                    
            except Exception as e:
                self.logger.error(f"Error in service monitor: {e}")

    async def run_services(self):
        """Run all services until interrupted"""
        try:
            if not await self.start_services():
                return
                
            # Wait for all service tasks to complete (they run indefinitely)
            await asyncio.gather(*self.service_tasks)
            
        except KeyboardInterrupt:
            self.logger.info("🛑 Shutdown signal received...")
        except Exception as e:
            self.logger.error(f"💥 Unexpected error in service execution: {e}")
        finally:
            await self.cleanup_services()

    async def cleanup_services(self):
        """Cleanup all services"""
        self.logger.info("🧹 Cleaning up services...")
        self.is_running = False
        
        # Cancel all running tasks
        if hasattr(self, 'service_tasks'):
            for task in self.service_tasks:
                if not task.done():
                    task.cancel()
            
            # Wait for tasks to complete cancellation
            await asyncio.gather(*self.service_tasks, return_exceptions=True)
        
        # Cleanup health servers
        if hasattr(self, 'health_runners'):
            for runner in self.health_runners:
                await runner.cleanup()
        
        # Cleanup services
        if 'cnn' in self.services:
            await self.services['cnn'].cleanup()
        if 'arduino' in self.services:
            await self.services['arduino'].cleanup()
            
        self.logger.info("✅ Services cleanup completed")

async def main():
    """Main entry point"""
    orchestrator = SmartRecyclingBinOrchestrator()
    
    # Setup signal handlers for graceful shutdown
    def signal_handler(signum, frame):
        logger.info(f"🛑 Received signal {signum}, initiating graceful shutdown...")
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        await orchestrator.run_services()
    except Exception as e:
        logger.error(f"💥 Critical error: {e}")
    finally:
        logger.info("🏁 Smart Recycling Bin services stopped")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Application interrupted by user")
    except Exception as e:
        logger.error(f"💥 Application failed: {e}")
        sys.exit(1)

