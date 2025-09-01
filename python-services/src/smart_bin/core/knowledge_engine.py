from experta import KnowledgeEngine, Rule, P
from typing import List, Optional
from ..models.waste_types import WasteClassification, WasteCategory
from ..models.decisions import ClassificationDecision
from .facts import WasteFact
from .resolver import DecisionResolver

class SmartBinKnowledgeEngine(KnowledgeEngine):
    """Knowledge engine for waste classification"""
    
    def __init__(self):
        super().__init__()
        self.candidates: List[WasteClassification] = []
        self.resolver = DecisionResolver()
        self.manual_override: Optional[WasteClassification] = None
        self.reasoning_trace: List[str] = []
        
    def add_candidate(self, category: WasteCategory, confidence: float, 
                     reasoning: str, disposal_location: str) -> None:
        """Add a candidate classification"""
        
        classification = WasteClassification(
            category=category,
            confidence=confidence,
            reasoning=reasoning,
            disposal_location=disposal_location
        )
        
        self.candidates.append(classification)
        self.reasoning_trace.append(f"→ Candidate Classification: {category.value.upper()}")
        self.reasoning_trace.append(f"   Reason: {reasoning}")
        self.reasoning_trace.append(f"   Proposed Disposal: {disposal_location}")
        
        print(f"\n→ Candidate Classification: {category.value.upper()}")
        print(f"   Reason: {reasoning}")
        print(f"   Proposed Disposal: {disposal_location}")
        
    def get_final_decision(self) -> ClassificationDecision:
        """Get the final classification decision"""
        if self.manual_override:
            final = self.manual_override
            is_override = True
        else:
            final = self.resolver.resolve_candidates(self.candidates)
            is_override = False
            
        return ClassificationDecision(
            final_classification=final,
            candidates=self.candidates.copy(),
            reasoning_trace=self.reasoning_trace.copy(),
            is_manual_override=is_override
        )
        
    def set_manual_override(self, category: WasteCategory, disposal_location: str, 
                          reasoning: str) -> None:
        """Set manual override"""
        self.manual_override = WasteClassification(
            category=category,
            confidence=1.0,
            reasoning=f"User override: {reasoning}",
            disposal_location=disposal_location
        )
        
    def reset_classification(self) -> None:
        """Reset for new classification"""
        self.candidates.clear()
        self.manual_override = None
        self.reasoning_trace.clear()
        self.reset()

    # =========================================================================
    # ================================ RULES ==================================
    # =========================================================================
    
    @Rule(WasteFact(cv_label='battery', is_metal=True), salience=110)
    def rule_battery_metal_combined(self):
        reason = "CV detected battery and metal sensor triggered; classified as e-waste due to domain knowledge."
        self.add_candidate(WasteCategory.EWASTE, 1.0, reason, "E-waste collection point")

    @Rule(WasteFact(cv_label='paint can', is_metal=True), salience=110)
    def rule_hazardous_paint_can(self):
        reason = "CV detected paint can and metal sensor triggered; hazardous waste prioritized."
        self.add_candidate(WasteCategory.HAZARDOUS, 1.0, reason, "Hazardous waste disposal facility")

    @Rule(WasteFact(cv_label='can', cv_confidence=P(lambda c: c >= 0.7)), salience=100)
    def rule_can(self):
        reason = "Computer vision confidently identified the item as 'can'. Metal detected by shape and texture."
        self.add_candidate(WasteCategory.METAL, 0.9, reason, "Metal recycling bin")

    @Rule(WasteFact(cv_label='banana peel', cv_confidence=P(lambda c: c >= 0.7)), salience=100)
    def rule_banana_peel(self):
        reason = "Computer vision confidently identified the item as 'banana peel'. Typical organic shape and color."
        self.add_candidate(WasteCategory.ORGANIC, 0.9, reason, "Organic waste bin / Compost bin")

    @Rule(WasteFact(cv_label='apple core', cv_confidence=P(lambda c: c >= 0.7)), salience=100)
    def rule_apple_core(self):
        reason = "Computer vision confidently identified the item as 'apple core'. Typical organic shape and color."
        self.add_candidate(WasteCategory.ORGANIC, 0.9, reason, "Organic waste bin / Compost bin")

    @Rule(WasteFact(cv_label='paper', cv_confidence=P(lambda c: c >= 0.7)), salience=100)
    def rule_paper(self):
        reason = "Computer vision confidently identified the item as 'paper'. Paper-like texture confirmed."
        self.add_candidate(WasteCategory.PAPER, 0.85, reason, "Paper recycling bin")

    @Rule(WasteFact(cv_label='plastic bottle', cv_confidence=P(lambda c: c >= 0.7)), salience=100)
    def rule_plastic_bottle(self):
        reason = "Computer vision confidently identified the item as 'plastic bottle'. PET shape and transparency detected."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.85, reason, "Plastic PET recycling bin")

    @Rule(WasteFact(cv_label='glass bottle', cv_confidence=P(lambda c: c >= 0.7)), salience=100)
    def rule_glass_bottle(self):
        reason = "Computer vision confidently identified the item as 'glass bottle'. Glass texture and shape identified."
        self.add_candidate(WasteCategory.GLASS, 0.9, reason, "Glass recycling bin")

    @Rule(WasteFact(is_metal=True), salience=90)
    def rule_metal_sensor(self):
        reason = "Metal sensor triggered indicating metal presence."
        self.add_candidate(WasteCategory.METAL, 0.95, reason, "Metal recycling bin")

    @Rule(WasteFact(is_moist=True), salience=80)
    def rule_moisture_sensor(self):
        reason = "Moisture detected; item is likely organic or wet paper."
        self.add_candidate(WasteCategory.ORGANIC, 0.7, reason, "Organic waste bin / Compost bin")

    @Rule(WasteFact(weight_grams=P(lambda w: w > 500)), salience=75)
    def rule_heavy_item(self):
        reason = "Item is heavy (>500g); may be bulk organic waste or metal."
        self.add_candidate(WasteCategory.ORGANIC, 0.6, reason, "Organic waste bin / Compost bin")

    @Rule(WasteFact(is_transparent=True), salience=70)
    def rule_transparency(self):
        reason = "Item is transparent, often indicating PET plastic."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.75, reason, "Plastic PET recycling bin")

    @Rule(WasteFact(is_flexible=True), salience=65)
    def rule_flexibility(self):
        reason = "Flexible item detected, may be soft plastic or paper."
        self.add_candidate(WasteCategory.PLASTIC_SOFT, 0.6, reason, "Special soft plastics recycling bin or trash")

    @Rule(WasteFact(), salience=10)
    def fallback_rule(self):
        if not self.candidates:
            self.add_candidate(WasteCategory.UNKNOWN, 0.3, "No clear indicators found.", "Manual sorting recommended")


