import logging
import asyncio
from .hub_client import SignalRHubClient

class SignalRLogHandler(logging.Handler):
    """
    A custom logging handler that sends log records to a SignalR hub.
    """
    def __init__(self, hub_url: str, service_name: str):
        super().__init__()
        self.service_name = service_name
        self.hub_client = SignalRHubClient(hub_url, "LogHub")
        self.loop = asyncio.get_event_loop()
        
        # Start connection in a non-blocking way
        self.loop.create_task(self.hub_client.connect())

    def emit(self, record):
        """
        Formats and sends the log record to the SignalR hub.
        """
        if not self.hub_client.is_connected:
            return

        try:
            log_line = self.format(record)
            # Use asyncio.run_coroutine_threadsafe to call async from sync
            asyncio.run_coroutine_threadsafe(
                self.hub_client.send_message("SendLog", self.service_name, log_line),
                self.loop
            )
        except Exception as e:
            # Avoid recursion if logging from within the handler fails
            print(f"Error in SignalRLogHandler: {e}")

