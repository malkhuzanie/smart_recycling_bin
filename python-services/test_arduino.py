# test_arduino.py

import asyncio
import logging
import sys
from pathlib import Path
import json # <--- ADD THIS LINE

# --- Setup logging to see detailed output ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

# --- Add the services directory to the Python path ---
# This allows us to import the arduino_service
services_path = Path(__file__).parent / "services"
sys.path.insert(0, str(services_path))

try:
    from services.arduino_service import ArduinoService
except ImportError as e:
    print(f"FATAL ERROR: Could not import ArduinoService. Make sure it's in the services/ directory.")
    print(f"Details: {e}")
    sys.exit(1)


async def main_test():
    """
    This function will initialize and test the ArduinoService.
    """
    logger = logging.getLogger("ArduinoTest")
    logger.info("--- Starting Arduino Service Standalone Test ---")

    # --- 1. Configuration ---
    # !! IMPORTANT: Make sure this port matches the one in your Arduino IDE !!
    # On Windows, it's like "COM3". On Linux/Mac, it's like "/dev/ttyUSB0" or "/dev/tty.usbmodem...".
    ARDUINO_PORT = "COM6"  # <-- CHANGE THIS TO YOUR ACTUAL PORT
    ARDUINO_BAUDRATE = 9600
    
    # We don't need a real backend for this test, so the URL doesn't matter.
    FAKE_BACKEND_URL = "http://localhost:9999/hub"

    # --- 2. Initialize the Service ---
    logger.info("Initializing ArduinoService...")
    arduino = ArduinoService(
        port=ARDUINO_PORT,
        baudrate=ARDUINO_BAUDRATE,
        backend_hub_url=FAKE_BACKEND_URL
    )

    # --- 3. Test the Connection ---
    logger.info("Attempting to connect to the hardware...")
    is_connected = await arduino.connect_arduino()

    if not is_connected:
        logger.error("!!! TEST FAILED: Could not connect to the Arduino.")
        logger.error("Please check the following:")
        logger.error(f"  - Is the Arduino plugged in?")
        logger.error(f"  - Is the port '{ARDUINO_PORT}' correct?")
        logger.error(f"  - Is the Arduino IDE's Serial Monitor closed?")
        return # Stop the test if connection fails

    logger.info("✅ Connection successful!")

    # --- 4. Test the Sensor Reading ---
    logger.info("\n--- Reading sensors every 2 seconds for 20 seconds ---")
    logger.info("--- (Press Ctrl+C to stop early) ---")
    await arduino.read_sensors()
    try:
        for i in range(10):
            print("-" * 20)
            logger.info(f"Reading #{i+1}...")
            
            # Call the same method the main application uses
            sensor_data = await arduino.read_sensors()

            if sensor_data:
                logger.info("✅ Successfully received and processed sensor data:")
                # Print the data in a nice format
                print(json.dumps(sensor_data, indent=2))
            else:
                logger.error("❌ Failed to receive sensor data for this reading.")
            
            await asyncio.sleep(2)
    except KeyboardInterrupt:
        logger.info("\nTest stopped by user.")
    except Exception as e:
        logger.error(f"An error occurred during the test: {e}")
    finally:
        # --- 5. Cleanup ---
        logger.info("\nCleaning up resources...")
        await arduino.cleanup()
        logger.info("--- Test Finished ---")


if __name__ == "__main__":
    # This block runs when you execute "python test_arduino.py"
    try:
        asyncio.run(main_test())
    except Exception as e:
        print(f"The test script encountered a fatal error: {e}")