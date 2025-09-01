"""
Simple Connection Test for SignalR
Tests the updated hub client without importing
"""

import asyncio
import aiohttp
import logging
import sys
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger("SimpleConnectionTest")

async def test_backend_endpoints():
    """Test backend endpoints"""
    backend_url = "http://localhost:5099"
    
    logger.info(f"🔍 Testing backend endpoints at {backend_url}...")
    
    tests = [
        ("Swagger", "/swagger/index.html", 200),
        ("API Root", "/api", 404),  # Expected 404 - no root API endpoint
        ("Classification Hub Negotiate", "/hubs/classification/negotiate?negotiateVersion=1", 200),
        ("Dashboard Hub Negotiate", "/hubs/dashboard/negotiate?negotiateVersion=1", 200),
    ]
    
    results = {}
    
    try:
        async with aiohttp.ClientSession() as session:
            for test_name, endpoint, expected_status in tests:
                try:
                    method = "POST" if "negotiate" in endpoint else "GET"
                    headers = {'Content-Type': 'application/json'} if method == "POST" else {}
                    
                    async with session.request(method, f"{backend_url}{endpoint}", 
                                             headers=headers,
                                             timeout=aiohttp.ClientTimeout(total=5)) as response:
                        
                        status = response.status
                        results[test_name] = status == expected_status
                        
                        if status == expected_status:
                            logger.info(f"✅ {test_name}: {status} (expected {expected_status})")
                        else:
                            logger.warning(f"⚠️  {test_name}: {status} (expected {expected_status})")
                            
                        if "negotiate" in endpoint and status == 200:
                            negotiate_response = await response.json()
                            conn_id = negotiate_response.get('connectionId', 'N/A')[:8]
                            logger.info(f"   → Connection ID: {conn_id}...")
                        
                except Exception as e:
                    logger.error(f"❌ {test_name} failed: {e}")
                    results[test_name] = False
                    
    except Exception as e:
        logger.error(f"❌ Session creation failed: {e}")
        return False
    
    all_passed = all(results.values())
    logger.info(f"📊 Backend tests: {sum(results.values())}/{len(results)} passed")
    return all_passed

async def test_direct_hub_connection():
    """Test direct hub connection using basic websocket"""
    import websockets
    import json
    
    logger.info("🔍 Testing direct SignalR hub connection...")
    
    try:
        # Step 1: Negotiate
        async with aiohttp.ClientSession() as session:
            negotiate_url = "http://localhost:5099/hubs/classification/negotiate?negotiateVersion=1"
            async with session.post(negotiate_url, 
                                  headers={'Content-Type': 'application/json'}) as response:
                if response.status != 200:
                    logger.error(f"❌ Negotiation failed: {response.status}")
                    return False
                
                negotiate_response = await response.json()
                connection_token = negotiate_response.get('connectionToken')
                
                if not connection_token:
                    logger.error("❌ No connection token received")
                    return False
                
                logger.info("✅ Negotiation successful")
        
        # Step 2: WebSocket connection
        ws_url = f"ws://localhost:5099/hubs/classification?id={connection_token}"
        
        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=10) as websocket:
            logger.info("✅ WebSocket connected")
            
            # Step 3: Send handshake
            handshake = {"protocol": "json", "version": 1}
            await websocket.send(json.dumps(handshake) + "\x1e")
            
            # Wait for handshake response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            
            if response.strip('\x1e') == "":
                logger.info("✅ Handshake completed")
            else:
                logger.warning(f"⚠️  Unexpected handshake response: {response}")
            
            # Step 4: Send test message
            test_message = {
                "type": 1,
                "invocationId": "1",
                "target": "TestMethod", 
                "arguments": ['{"test": "data"}']
            }
            
            await websocket.send(json.dumps(test_message) + "\x1e")
            logger.info("✅ Test message sent")
            
            # Wait a bit for any response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                logger.info(f"📨 Received response: {response}")
            except asyncio.TimeoutError:
                logger.info("📭 No immediate response (expected)")
            
            logger.info("✅ Direct hub connection test successful")
            return True
            
    except Exception as e:
        logger.error(f"❌ Direct hub connection failed: {e}")
        return False

async def test_import_services():
    """Test if we can import the services with updated hub client"""
    logger.info("🔍 Testing service imports...")
    
    try:
        # Add services path
        services_path = Path(__file__).parent / "services"
        sys.path.insert(0, str(services_path))
        
        # Try to import the hub client
        from hub_client import SignalRHubClient
        logger.info("✅ Hub client imported successfully")
        
        # Create a test instance
        test_client = SignalRHubClient("http://localhost:5099/hubs/classification", "TestClient")
        logger.info("✅ Hub client instance created")
        
        # Test if it has the new methods
        has_negotiate = hasattr(test_client, 'negotiate_connection')
        has_handshake = hasattr(test_client, 'send_handshake')
        has_websocket = hasattr(test_client, 'establish_websocket_connection')
        
        if has_negotiate and has_handshake and has_websocket:
            logger.info("✅ Hub client has new SignalR protocol methods")
            return True
        else:
            logger.error("❌ Hub client missing new protocol methods - needs to be updated")
            return False
            
    except ImportError as e:
        logger.error(f"❌ Cannot import hub client: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Hub client test failed: {e}")
        return False

async def main():
    """Run all connection tests"""
    logger.info("🚀 Starting Simple SignalR Connection Tests")
    logger.info("=" * 60)
    
    tests = [
        ("Backend Endpoints", test_backend_endpoints),
        ("Service Import", test_import_services),
        ("Direct Hub Connection", test_direct_hub_connection),
    ]
    
    all_passed = True
    
    for test_name, test_func in tests:
        logger.info(f"\n📋 Running {test_name}...")
        try:
            result = await test_func()
            if not result:
                all_passed = False
        except Exception as e:
            logger.error(f"❌ {test_name} raised exception: {e}")
            all_passed = False
    
    logger.info("\n" + "=" * 60)
    if all_passed:
        logger.info("🎉 ALL TESTS PASSED!")
        logger.info("✅ Backend is ready for SignalR connections")
        logger.info("🚀 You can now run: python orchestrated_main_service.py")
    else:
        logger.error("❌ Some tests failed.")
        logger.error("📋 Action items:")
        logger.error("   1. Replace python-services/services/hub_client.py with updated version")
        logger.error("   2. Ensure backend is running: cd backend && dotnet run")
        logger.error("   3. Check firewall settings")
    
    logger.info("=" * 60)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
    except Exception as e:
        logger.error(f"Test script failed: {e}")
