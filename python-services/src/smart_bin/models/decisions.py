from dataclasses import dataclass
from typing import List, Optional
from .waste_types import WasteClassification

@dataclass
class ClassificationDecision:
    final_classification: Optional[WasteClassification]
    candidates: List[WasteClassification]
    reasoning_trace: List[str]
    is_manual_override: bool = False
    confidence_score: float = 0.0

    def __post_init__(self):
        if self.final_classification:
            self.confidence_score = self.final_classification.confidence

