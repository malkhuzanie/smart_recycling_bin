from dataclasses import dataclass
from typing import Optional, Any
from datetime import datetime

@dataclass
class SensorReading:
    sensor_type: str
    value: Any
    confidence: float
    timestamp: Optional[datetime] = None

@dataclass
class CVReading(SensorReading):
    label: str = ""
    cv_confidence: float = 0.0
    
    def __post_init__(self):
        self.sensor_type = "computer_vision"
        self.value = self.label
        self.confidence = self.cv_confidence

@dataclass
class PhysicalSensorReading(SensorReading):
    def __init__(self, sensor_type: str, value: Any, confidence: float = 1.0):
        super().__init__(sensor_type, value, confidence, datetime.now())

