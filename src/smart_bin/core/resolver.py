from typing import List, Optional
from ..models.waste_types import WasteClassification, WasteCategory

class DecisionResolver:
    """Decision resolution with priority-based scoring using enum values"""
    
    def __init__(self):
        self.priority_order = {
            WasteCategory.HAZARDOUS: 7,
            WasteCategory.EWASTE: 6,
            WasteCategory.GLASS: 5,
            WasteCategory.METAL: 4,
            WasteCategory.PLASTIC_PET: 3,
            WasteCategory.PLASTIC_SOFT: 2,
            WasteCategory.PAPER: 3,
            WasteCategory.ORGANIC: 4,
            WasteCategory.TEXTILE: 2,
            WasteCategory.RUBBER: 1,
            WasteCategory.COMPOSITE: 1,
            WasteCategory.UNKNOWN: 0
        }
    
    def resolve_candidates(self, candidates: List[WasteClassification]) -> Optional[WasteClassification]:
        """Resolve competing candidates using priority first, then confidence"""
        if not candidates:
            return None
            
        def sort_key(c):
            priority = self.priority_order.get(c.category, 0) 
            # Priority comes first, then confidence as tiebreaker
            return (priority, c.confidence)
            
        return max(candidates, key=sort_key)
