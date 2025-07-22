"""Smart Recycling Bin Package"""
__version__ = "1.0.0"
__author__ = "TBD"

"""Data models for the smart bin system"""

from .models.waste_types import WasteCategory, WasteClassification
from .models.sensors import SensorReading, CVReading, PhysicalSensorReading
from .models.decisions import ClassificationDecision

__all__ = [
    'WasteCategory',
    'WasteClassification', 
    'SensorReading',
    'CVReading',
    'PhysicalSensorReading',
    'ClassificationDecision'
]

