# python-services/src/smart_bin/core/facts.py (Final Version)

from experta import Fact
from typing import Optional

class WasteFact(Fact):
    """
    Fact class for waste items. Mirrors the exact data available from
    YOLO and the processed Arduino service data.
    """
    
    # --- Data from Computer Vision (YOLO) ---
    cv_label: Optional[str] = None
    cv_confidence: Optional[float] = None

    # --- Data from Physical Sensors (Arduino) ---
    weight_grams: Optional[float] = None
    is_metal: Optional[bool] = None
    humidity_percent: Optional[float] = None
    ir_transparency: Optional[float] = None # A value from 0.0 to 1.0

    # --- Derived Sensor Properties (from arduino_service) ---
    is_moist: Optional[bool] = None
    is_transparent: Optional[bool] = None