from dataclasses import dataclass
from enum import Enum

class WasteCategory(Enum):
    ORGANIC = "organic"
    PLASTIC_PET = "plastic (PET)"
    PLASTIC_SOFT = "plastic (soft)"
    GLASS = "glass"
    METAL = "metal"
    PAPER = "paper"
    TEXTILE = "textile"
    EWASTE = "e-waste"
    HAZARDOUS = "hazardous waste"
    RUBBER = "rubber"
    COMPOSITE = "composite material"
    UNKNOWN = "unknown"

@dataclass
class WasteClassification:
    category: WasteCategory
    confidence: float
    reasoning: str
    disposal_location: str
    priority_score: int = 0
