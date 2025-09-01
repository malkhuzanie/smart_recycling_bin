"""
Enhanced SignalR Hub Client for Python services
UPDATED: Now implements proper SignalR negotiation protocol
Handles robust connection management and message handling
"""

import asyncio
import aiohttp
import json
import logging
from typing import Dict, Any, Callable, Optional
import websockets
from datetime import datetime
import ssl
import urllib.parse
from uuid import uuid4

class SignalRHubClient:
    """Enhanced SignalR Hub client with PROPER SignalR protocol implementation"""
    
    def __init__(self, hub_url: str, hub_name: str):
        # Parse the hub URL correctly
        if '/hubs/' in hub_url:
            self.base_url = hub_url.split('/hubs/')[0]
            self.hub_path = '/hubs/' + hub_url.split('/hubs/')[1]
        else:
            self.base_url = hub_url.rstrip('/')
            self.hub_path = '/hubs/classification'
            
        self.hub_name = hub_name
        self.connection = None
        self.is_connected = False
        self.logger = logging.getLogger(f"SignalRClient-{hub_name}")
        
        # Connection management
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 5  # seconds
        self.connection_timeout = 30  # seconds
        
        # SignalR protocol specific
        self.connection_token = None
        self.connection_id = None
        self.negotiate_version = 1
        
        # Message handling
        self.message_queue = asyncio.Queue()
        self.pending_messages = []
        self.message_handlers = {}
        self.invocation_id = 0
        
        # Health monitoring
        self.last_heartbeat = None
        self.heartbeat_interval = 30  # seconds
        
    async def connect(self) -> bool:
        """Connect to SignalR hub with PROPER negotiation protocol"""
        while self.reconnect_attempts < self.max_reconnect_attempts:
            try:
                self.logger.info(f"Connecting to SignalR hub: {self.base_url}{self.hub_path} (attempt {self.reconnect_attempts + 1})")
                
                # Step 1: Negotiate connection (CRITICAL for SignalR)
                if not await self.negotiate_connection():
                    self.reconnect_attempts += 1
                    await asyncio.sleep(self.reconnect_delay)
                    continue
                
                # Step 2: Establish WebSocket connection using negotiated token
                if not await self.establish_websocket_connection():
                    self.reconnect_attempts += 1
                    await asyncio.sleep(self.reconnect_delay)
                    continue
                
                # Step 3: Send SignalR handshake
                if not await self.send_handshake():
                    self.reconnect_attempts += 1
                    await asyncio.sleep(self.reconnect_delay)
                    continue
                
                self.is_connected = True
                self.reconnect_attempts = 0
                self.last_heartbeat = datetime.now()
                
                self.logger.info(f"✅ Connected to SignalR hub: {self.hub_name}")
                
                # Start message handling tasks
                asyncio.create_task(self.message_handler_worker())
                asyncio.create_task(self.connection_monitor_worker())
                
                # Send pending messages
                await self.send_pending_messages()
                
                return True
                
            except Exception as e:
                self.reconnect_attempts += 1
                self.logger.error(f"❌ Connection attempt {self.reconnect_attempts} failed: {e}")
                
                if self.reconnect_attempts >= self.max_reconnect_attempts:
                    self.logger.error(f"❌ Max reconnection attempts reached for {self.hub_name}")
                    return False
                
                await asyncio.sleep(self.reconnect_delay)
                self.reconnect_delay = min(self.reconnect_delay * 2, 60)  # Exponential backoff
        
        return False
    
    async def negotiate_connection(self) -> bool:
        """Perform SignalR negotiation to get connection info"""
        try:
            negotiate_url = f"{self.base_url}{self.hub_path}/negotiate?negotiateVersion={self.negotiate_version}"
            
            self.logger.debug(f"Negotiating connection: {negotiate_url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.post(negotiate_url, 
                                      headers={'Content-Type': 'application/json'},
                                      timeout=aiohttp.ClientTimeout(total=10)) as response:
                    
                    if response.status != 200:
                        self.logger.error(f"Negotiate failed with status: {response.status}")
                        response_text = await response.text()
                        self.logger.error(f"Response: {response_text}")
                        return False
                    
                    negotiate_response = await response.json()
                    self.logger.debug(f"Negotiate response: {negotiate_response}")
                    
                    self.connection_token = negotiate_response.get('connectionToken')
                    self.connection_id = negotiate_response.get('connectionId')
                    
                    if not self.connection_token:
                        self.logger.error("No connection token received from negotiation")
                        return False
                    
                    self.logger.info(f"✅ Negotiated connection: {self.connection_id}")
                    return True
                    
        except Exception as e:
            self.logger.error(f"Negotiation failed: {e}")
            return False
    
    async def establish_websocket_connection(self) -> bool:
        """Establish WebSocket connection using negotiated info"""
        try:
            # Build WebSocket URL using connection token
            ws_url = self.base_url.replace('http://', 'ws://').replace('https://', 'wss://')
            ws_url = f"{ws_url}{self.hub_path}?id={self.connection_token}"
            
            self.logger.debug(f"Connecting to WebSocket: {ws_url}")
            
            # Configure SSL context for secure connections
            ssl_context = None
            if ws_url.startswith('wss://'):
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
            
            # Establish WebSocket connection
            self.connection = await websockets.connect(
                ws_url,
                ping_interval=20,
                ping_timeout=10,
                close_timeout=10,
                ssl=ssl_context,
                # extra_headers={
                #     'User-Agent': 'Python SignalR Client'
                # }
            )
            
            self.logger.info(f"✅ WebSocket connected: {ws_url[:50]}...")
            return True
            
        except Exception as e:
            self.logger.error(f"WebSocket connection failed: {e}")
            return False
    
    async def send_handshake(self) -> bool:
        """Send SignalR handshake message"""
        try:
            handshake_message = {
                "protocol": "json",
                "version": 1
            }
            
            # SignalR handshake format: JSON + record separator
            handshake_json = json.dumps(handshake_message) + "\x1e"
            await self.connection.send(handshake_json)
            
            self.logger.debug("Sent handshake message")
            
            # Wait for handshake response
            response = await asyncio.wait_for(self.connection.recv(), timeout=5.0)
            
            cleaned_response = response.strip('\x1e').strip()

            if cleaned_response == "" or cleaned_response == "{}":
                self.logger.info("✅ Handshake completed successfully")
                return True
            else:
                self.logger.debug(f"Handshake response: {response}")
                self.logger.info("✅ Handshake completed (non-standard response)")
                return True
                
        except Exception as e:
            self.logger.error(f"Handshake failed: {e}")
            return False
    
    async def send_message(self, method: str, data: str) -> bool:
        """Send message to SignalR hub with proper protocol format"""
        self.invocation_id += 1
        
        arguments = [] if data  == "" else [data]

        message = {
            "type": 1,  # Invocation message type
            "invocationId": str(self.invocation_id),
            "target": method,
            "arguments": arguments
        }
        
        if not self.is_connected or not self.connection:
            self.logger.warning(f"Not connected, queuing message: {method}")
            self.pending_messages.append(message)
            return False
            
        try:
            # Create SignalR message format with record separator
            message_json = json.dumps(message) + "\x1e"
            await self.connection.send(message_json)
            
            self.logger.debug(f"✅ Message sent: {method} (ID: {self.invocation_id})")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Failed to send message {method}: {e}")
            self.is_connected = False
            self.pending_messages.append(message)  # Queue for later
            
            # Trigger reconnection
            asyncio.create_task(self.reconnect())
            return False

    async def send_pending_messages(self):
        """Send all pending messages after reconnection"""
        if not self.pending_messages:
            return
        
        self.logger.info(f"Sending {len(self.pending_messages)} pending messages...")
        
        failed_messages = []
        for message in self.pending_messages:
            try:
                # Update invocation ID for retry
                self.invocation_id += 1
                message["invocationId"] = str(self.invocation_id)
                
                message_json = json.dumps(message) + "\x1e"
                await self.connection.send(message_json)
                self.logger.debug(f"✅ Pending message sent: {message['target']}")
            except Exception as e:
                self.logger.error(f"❌ Failed to send pending message: {e}")
                failed_messages.append(message)
        
        # Keep only failed messages for retry
        self.pending_messages = failed_messages
        self.logger.info(f"Pending messages processed. {len(failed_messages)} failed.")

    async def message_handler_worker(self):
        """Worker that handles incoming messages from the hub"""
        try:
            async for message in self.connection:
                try:
                    # Update heartbeat
                    self.last_heartbeat = datetime.now()
                    
                    # Parse SignalR message(s) - can contain multiple messages
                    if isinstance(message, str):
                        # Split by record separator in case multiple messages
                        messages = message.split('\x1e')
                        for msg in messages:
                            if msg.strip():  # Skip empty messages
                                try:
                                    parsed_message = json.loads(msg)
                                    await self.handle_incoming_message(parsed_message)
                                except json.JSONDecodeError:
                                    self.logger.debug(f"Non-JSON message received: {msg}")
                        
                except Exception as e:
                    self.logger.error(f"Error handling incoming message: {e}")
                    
        except websockets.exceptions.ConnectionClosed as e:
            self.logger.warning(f"Connection closed: {e}")
            self.is_connected = False
            await self.reconnect()
        except Exception as e:
            self.logger.error(f"Error in message handler worker: {e}")
            self.is_connected = False
            await self.reconnect()

    async def handle_incoming_message(self, message: Dict):
        """Handle incoming SignalR message"""
        message_type = message.get("type")
        
        if message_type == 1:  # Invocation
            method = message.get("target")
            arguments = message.get("arguments", [])
            
            if method in self.message_handlers:
                try:
                    await self.message_handlers[method](*arguments)
                except Exception as e:
                    self.logger.error(f"Error in message handler for {method}: {e}")
            else:
                self.logger.debug(f"No handler for method: {method}")
                
        elif message_type == 2:  # StreamItem
            self.logger.debug("Received stream item")
            
        elif message_type == 3:  # Completion
            invocation_id = message.get("invocationId")
            error = message.get("error")
            
            if error:
                self.logger.error(f"Invocation {invocation_id} failed: {error}")
            else:
                self.logger.debug(f"Invocation {invocation_id} completed successfully")
            
        elif message_type == 6:  # Ping
            # Respond with pong
            pong_message = {"type": 6}
            try:
                await self.connection.send(json.dumps(pong_message) + "\x1e")
                self.logger.debug("Responded to ping with pong")
            except:
                self.logger.warning("Failed to send pong response")

    def register_handler(self, method: str, handler: Callable):
        """Register a handler for incoming hub messages"""
        self.message_handlers[method] = handler
        self.logger.info(f"Registered handler for method: {method}")

    async def connection_monitor_worker(self):
        """Worker that monitors connection health"""
        while self.is_connected:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                # Check if we haven't received any messages recently
                if self.last_heartbeat:
                    time_since_heartbeat = (datetime.now() - self.last_heartbeat).total_seconds()
                    
                    if time_since_heartbeat > self.heartbeat_interval * 2:
                        self.logger.warning("No heartbeat received, connection may be stale")
                        self.is_connected = False
                        await self.reconnect()
                        break
                
                # Send ping to keep connection alive
                ping_message = {"type": 6}  # Ping
                try:
                    await self.connection.send(json.dumps(ping_message) + "\x1e")
                    self.logger.debug("Sent heartbeat ping")
                except:
                    self.logger.warning("Failed to send heartbeat ping")
                    self.is_connected = False
                    await self.reconnect()
                    break
                    
            except Exception as e:
                self.logger.error(f"Error in connection monitor: {e}")

    async def reconnect(self):
        """Reconnect to the hub"""
        if self.is_connected:
            return  # Already connected
        
        self.logger.info("Attempting to reconnect...")
        await self.disconnect()
        await asyncio.sleep(1)  # Brief pause
        await self.connect()

    async def disconnect(self):
        """Disconnect from SignalR hub"""
        self.is_connected = False
        
        if self.connection:
            try:
                await self.connection.close()
            except:
                pass
            self.connection = None
            
        self.logger.info("Disconnected from SignalR hub")
    
    async def ensure_connection(self):
        """Ensure connection is active, reconnect if needed"""
        if not self.is_connected:
            await self.connect()

    async def join_group(self, group_name: str):
        """Join a SignalR group"""
        await self.send_message(f"Join{group_name}Group", "{}")

    async def leave_group(self, group_name: str):
        """Leave a SignalR group"""
        await self.send_message(f"Leave{group_name}Group", "{}")

    def get_connection_status(self) -> Dict:
        """Get current connection status"""
        return {
            "connected": self.is_connected,
            "base_url": self.base_url,
            "hub_path": self.hub_path,
            "hub_name": self.hub_name,
            "connection_id": self.connection_id,
            "reconnect_attempts": self.reconnect_attempts,
            "pending_messages": len(self.pending_messages),
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None
        }

# Backward compatibility alias
SignalRHubClient = SignalRHubClient
