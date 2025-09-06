# python-services/src/smart_bin/core/knowledge_engine.py (Comprehensive Version)

from experta import KnowledgeEngine, Rule, P, W, MATCH, AS
from typing import List, Optional
from ..models.waste_types import WasteClassification, WasteCategory
from ..models.decisions import ClassificationDecision
from .facts import WasteFact
from .resolver import DecisionResolver

class SmartBinKnowledgeEngine(KnowledgeEngine):
    """
    Comprehensive knowledge engine for waste classification using YOLO and sensor fusion.
    Rules are prioritized by salience from most certain to least certain.
    """
    
    def __init__(self):
        super().__init__()
        self.candidates: List[WasteClassification] = []
        self.resolver = DecisionResolver()
        self.reasoning_trace: List[str] = []
        
    def add_candidate(self, category: WasteCategory, confidence: float, 
                     reasoning: str, disposal_location: str) -> None:
        """Helper function to add a candidate classification."""
        classification = WasteClassification(
            category=category, confidence=confidence,
            reasoning=reasoning, disposal_location=disposal_location
        )
        self.candidates.append(classification)
        self.reasoning_trace.append(f"-> RULE FIRED: {reasoning}")

    def get_final_decision(self) -> ClassificationDecision:
        """Resolves candidates to get the final decision."""
        final_classification = self.resolver.resolve_candidates(self.candidates)
        return ClassificationDecision(
            final_classification=final_classification,
            candidates=self.candidates.copy(),
            reasoning_trace=self.reasoning_trace.copy()
        )
        
    def reset(self) -> None:
        """Resets the engine for a new classification run."""
        self.candidates.clear()
        self.reasoning_trace.clear()
        super().reset()

    # =========================================================================
    # PRIORITY 1: DEFINITIVE SENSOR RULES (Salience 100-110)
    # These rules are the most reliable and should override almost everything else.
    # =========================================================================
    
    @Rule(WasteFact(is_metal=True), salience=110)
    def rule_definitive_metal(self):
        reason = "Metal sensor triggered. This is the most reliable indicator for metal."
        self.add_candidate(WasteCategory.METAL, 0.99, reason, "Metal Recycling Bin")

    @Rule(WasteFact(is_moist=True), salience=100)
    def rule_definitive_organic(self):
        reason = "Moisture sensor indicates high humidity. This is a strong indicator of organic waste."
        self.add_candidate(WasteCategory.ORGANIC, 0.98, reason, "Organic Waste / Compost Bin")

    # =========================================================================
    # PRIORITY 2: HIGH-CONFIDENCE VISUAL RULES (Salience 90-99)
    # These rules fire when YOLO is very certain about a non-ambiguous object.
    # =========================================================================

    @Rule(WasteFact(cv_label=P(lambda x: x in ['banana', 'apple', 'orange', 'carrot', 'broccoli', 'hot dog', 'pizza', 'donut', 'cake'])),
          salience=95)
    def rule_obvious_food_item(self, cv_label):
        reason = f"Visual detection confirmed a clear food item ('{cv_label}')."
        self.add_candidate(WasteCategory.ORGANIC, 0.98, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(cv_label='book', cv_confidence=P(lambda c: c > 0.7)), salience=90)
    def rule_book_as_paper(self):
        reason = "High confidence visual detection of a 'book'."
        self.add_candidate(WasteCategory.PAPER, 0.95, reason, "Paper Recycling Bin")

    @Rule(WasteFact(cv_label='scissors', cv_confidence=P(lambda c: c > 0.7)), salience=90)
    def rule_scissors_as_metal(self):
        reason = "High confidence visual detection of 'scissors', which are metal."
        self.add_candidate(WasteCategory.METAL, 0.95, reason, "Metal Recycling Bin")

    # =========================================================================
    # PRIORITY 3: SENSOR + VISION FUSION RULES (Salience 70-89)
    # The core logic. These rules combine inputs for a robust decision.
    # =========================================================================

    @Rule(WasteFact(is_metal=False, is_transparent=True, cv_label='bottle', 
                    weight_grams=P(lambda w: w > 100)), salience=85)
    def rule_glass_bottle_heavy(self):
        reason = "Fusion: Visually a 'bottle', sensors show it is not metal, transparent, and heavy (>100g). Strong evidence for Glass."
        self.add_candidate(WasteCategory.GLASS, 0.95, reason, "Glass Recycling Bin")

    @Rule(WasteFact(is_metal=False, cv_label='bottle', weight_grams=P(lambda w: w < 75)), salience=85)
    def rule_plastic_bottle_light(self):
        reason = "Fusion: Visually a 'bottle', sensors show it is not metal and lightweight (<75g). Strong evidence for Plastic."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.95, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(is_metal=False, is_transparent=True, cv_label='cup'), salience=80)
    def rule_plastic_cup_transparent(self):
        reason = "Fusion: Visually a 'cup', sensors confirm not metal and transparent. High probability of being a Plastic cup."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.90, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(is_metal=False, is_transparent=False, cv_label='cup',
                    weight_grams=P(lambda w: w < 50)), salience=80)
    def rule_paper_cup_light(self):
        reason = "Fusion: Visually a 'cup', sensors confirm not metal, not transparent, and lightweight. High probability of being a Paper cup."
        self.add_candidate(WasteCategory.PAPER, 0.90, reason, "Paper Recycling Bin")

    @Rule(WasteFact(is_metal=False, cv_label='bowl', is_moist=False), salience=75)
    def rule_non_organic_bowl(self):
        reason = "Fusion: Visually a 'bowl' but sensors show it is not moist, ruling out organic. Could be plastic or paper."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.75, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.PAPER, 0.75, reason, "Paper Recycling Bin")
        
    @Rule(WasteFact(is_metal=False, is_transparent=False, weight_grams=P(lambda w: w > 200)), salience=70)
    def rule_heavy_non_metal_non_transparent(self):
        reason = "Sensor-driven: Item is heavy but not metal or transparent. Could be dense organic or ceramic."
        self.add_candidate(WasteCategory.ORGANIC, 0.7, reason, "Organic Waste / Compost Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.6, reason, "Manual Inspection Bin") # Ceramic is often not recyclable

    # =========================================================================
    # PRIORITY 4: EDUCATED GUESSES / FALLBACK RULES (Salience 1-69)
    # These rules handle cases where the evidence is not definitive.
    # =========================================================================

    @Rule(WasteFact(is_metal=False, cv_label='bottle'), salience=50)
    def rule_ambiguous_bottle(self):
        reason = "Fallback: Visually a 'bottle' and not metal, but weight is ambiguous. Could be Plastic or Glass."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.7, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.GLASS, 0.7, reason, "Glass Recycling Bin")
        
    @Rule(WasteFact(is_metal=False, cv_label='cup'), salience=50)
    def rule_ambiguous_cup(self):
        reason = "Fallback: Visually a 'cup' and not metal, but other sensors are ambiguous. Could be Plastic or Paper."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.7, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.PAPER, 0.7, reason, "Paper Recycling Bin")

    # =========================================================================
    # PRIORITY 5: FINAL FALLBACK (Salience -1)
    # This rule only fires if no other rules have managed to add a candidate.
    # =========================================================================

    @Rule(salience=-1)
    def rule_final_fallback_unknown(self):
        if not self.candidates:
            # We also get the original yolo guess to add to the reasoning
            fact = self.facts[1] # Facts are indexed from 1 in Experta
            cv_guess = fact.get('cv_label', 'unknown')
            reason = f"No specific rules matched the inputs. Visual system saw a '{cv_guess}'. Manual inspection required."
            self.add_candidate(WasteCategory.UNKNOWN, 0.5, reason, "Manual Inspection Bin")