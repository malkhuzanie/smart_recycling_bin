from experta import Fact
from typing import Optional

class WasteFact(Fact):
    """Fact class for waste items with sensor data"""
    
    # Computer Vision
    cv_label: Optional[str] = None
    cv_confidence: Optional[float] = None
    
    # Physical Properties
    weight_grams: Optional[float] = None
    
    # Sensor Data
    is_metal: Optional[bool] = None
    is_moist: Optional[bool] = None
    is_transparent: Optional[bool] = None
    is_flexible: Optional[bool] = None
