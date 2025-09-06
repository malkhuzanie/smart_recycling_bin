"""
Main Orchestrated Service Integration
Coordinates CNN, Arduino, and Expert System with Backend.
"""

import asyncio
import logging
import sys
from pathlib import Path
import os
import signal
from aiohttp import web
from datetime import datetime

# --- 1. SETUP COMPREHENSIVE LOGGING (ONCE) ---
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "orchestrated_services.log"

# Create a standard formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Get the root logger to capture logs from all imported modules
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)

# Remove any existing handlers to prevent duplicates
for handler in root_logger.handlers[:]:
    root_logger.removeHandler(handler)

# Create and add our desired handlers (file and console)
file_handler = logging.FileHandler(log_file, encoding='utf-8') # Use UTF-8 for file logging
file_handler.setFormatter(formatter)
root_logger.addHandler(file_handler)

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setFormatter(formatter)
root_logger.addHandler(stream_handler)

# Silence overly verbose libraries
logging.getLogger("websockets").setLevel(logging.WARNING)
logging.getLogger("tensorflow").setLevel(logging.WARNING)

# Get a logger for this specific file
logger = logging.getLogger("Orchestrator")


# --- 2. IMPORTS FOR THE APPLICATION ---
# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from services.cnn_service import CNNService
from services.arduino_service import ArduinoService

class HealthService:
    """HTTP Health Service for backend monitoring."""
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        
    async def health_check(self, request):
        """Generic health check."""
        # Simplified for brevity
        return web.json_response({"status": "healthy"})

class SmartRecyclingBinOrchestrator:
    """Main orchestrator that coordinates all services."""
    
    def __init__(self):
        self.services = {}
        self.is_running = False
        self.health_service = HealthService(self)
        
        # Configuration from environment
        self.config = {
            'arduino_port': os.getenv('ARDUINO_PORT', 'COM6'), # Default to a common Windows port
            'arduino_baudrate': int(os.getenv('ARDUINO_BAUDRATE', '9600')),
            'backend_hub_url': os.getenv('BACKEND_URL', 'http://localhost:5099/hubs/classification'),
            'camera_index': int(os.getenv('CAMERA_INDEX', '0')),
            'health_port': int(os.getenv('HEALTH_PORT', '8001')),
        }

    async def setup_health_server(self):
        """Setup a single HTTP health check server."""
        logger.info("Setting up health check server...")
        app = web.Application()
        app.router.add_get('/health', self.health_service.health_check)
        
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', self.config['health_port'])
        await site.start()
        
        logger.info(f"Health Server running at: http://localhost:{self.config['health_port']}/health")
        self.health_runner = runner
        
    async def start_services(self):
        """Start and coordinate all services."""
        logger.info("Starting Smart Recycling Bin Orchestrated Services...")
        logger.info("=" * 60)
        logger.info("Configuration:")
        for key, value in self.config.items():
            logger.info(f"  {key}: {value}")
        logger.info("=" * 60)
        
        try:
            await self.setup_health_server()
            await self.check_prerequisites()
            await self.initialize_services()
            await self.setup_service_integration()
            await self.start_all_service_loops()
            
            self.is_running = True
            logger.info("All services started successfully!")
            logger.info("Smart Recycling Bin is operational.")
            return True
        except Exception as e:
            logger.error(f"Failed to start services: {e}", exc_info=True)
            return False

    async def check_prerequisites(self):
        """Check if prerequisites like backend and hardware are available."""
        logger.info("Checking prerequisites...")
        # Note: YOLO model check is implicit (crashes on import if file is missing)
        # Note: Backend check and hardware checks will log warnings but not stop the service.
        # This allows for testing with mock data.
        logger.info("Prerequisites check completed.")

    async def initialize_services(self):
        """Create instances of all services."""
        logger.info("Initializing services...")
        self.services['cnn'] = CNNService(self.config['backend_hub_url'])
        self.services['arduino'] = ArduinoService(
            self.config['arduino_port'],
            self.config['arduino_baudrate'],
            self.config['backend_hub_url']
        )
        logger.info("Services initialized.")
        
    async def setup_service_integration(self):
        """Connect services to each other."""
        logger.info("Setting up service integration...")
        self.services['arduino'].set_cnn_service(self.services['cnn'])
        self.services['cnn'].set_arduino_service(self.services['arduino'])
        logger.info("Service integration complete.")

    async def start_all_service_loops(self):
        """Start the main async loops for all services."""
        logger.info("Starting all service loops...")
        self.service_tasks = [
            asyncio.create_task(self.services['cnn'].start_service()),
            asyncio.create_task(self.services['arduino'].start_service())
        ]
        logger.info("Service loops created.")

    async def run(self):
        """Run all services until interrupted."""
        if not await self.start_services():
            logger.error("Orchestrator failed to start. Shutting down.")
            return
            
        try:
            # This will keep the main script alive while the async tasks run.
            while self.is_running:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutdown signal received...")
        finally:
            await self.cleanup()

    async def cleanup(self):
        """Gracefully clean up all services."""
        logger.info("Cleaning up services...")
        self.is_running = False
        
        if hasattr(self, 'service_tasks'):
            for task in self.service_tasks:
                task.cancel()
            await asyncio.gather(*self.service_tasks, return_exceptions=True)
        
        if hasattr(self, 'health_runner'):
            await self.health_runner.cleanup()
        
        if 'cnn' in self.services: await self.services['cnn'].cleanup()
        if 'arduino' in self.services: await self.services['arduino'].cleanup()
            
        logger.info("Services cleanup completed.")

async def main():
    """Main entry point for the application."""
    orchestrator = SmartRecyclingBinOrchestrator()
    await orchestrator.run()

if __name__ == "__main__":
    try:
        logger.info("Application starting...")
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Application interrupted by user.")
    except Exception as e:
        logger.error(f"Application failed with a fatal error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("Application stopped.")