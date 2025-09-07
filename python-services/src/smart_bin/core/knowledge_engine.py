# python-services/src/smart_bin/core/knowledge_engine.py (Final Corrected Comprehensive Version)

from experta import KnowledgeEngine, Rule, P, MATCH
from typing import List, Optional
from ..models.waste_types import WasteClassification, WasteCategory
from ..models.decisions import ClassificationDecision
from .facts import WasteFact
from .resolver import DecisionResolver

class SmartBinKnowledgeEngine(KnowledgeEngine):
    """
    Enhanced comprehensive knowledge engine for waste classification using YOLO and sensor fusion.
    Rules are prioritized by salience from most certain to least certain.
    Covers all RELEVANT_CLASSES with sophisticated sensor fusion logic.
    """
    
    def __init__(self):
        super().__init__()
        self.candidates: List[WasteClassification] = []
        self.resolver = DecisionResolver()
        self.reasoning_trace: List[str] = []
        
    def add_candidate(self, category: WasteCategory, confidence: float, 
                     reasoning: str, disposal_location: str) -> None:
        classification = WasteClassification(
            category=category, confidence=confidence,
            reasoning=reasoning, disposal_location=disposal_location
        )
        self.candidates.append(classification)
        self.reasoning_trace.append(f"-> RULE FIRED: {reasoning}")

    def get_final_decision(self) -> ClassificationDecision:
        final_classification = self.resolver.resolve_candidates(self.candidates)
        return ClassificationDecision(
            final_classification=final_classification,
            candidates=self.candidates.copy(),
            reasoning_trace=self.reasoning_trace.copy()
        )
        
    def reset(self) -> None:
        self.candidates.clear()
        self.reasoning_trace.clear()
        super().reset()

    # =========================================================================
    # PRIORITY 1: DEFINITIVE SENSOR RULES (Salience 100-110)
    # =========================================================================
    
    @Rule(WasteFact(is_metal=True), salience=110)
    def rule_definitive_metal(self):
        reason = "Metal sensor triggered. This is the most reliable indicator for metal objects."
        self.add_candidate(WasteCategory.METAL, 0.99, reason, "Metal Recycling Bin")

    @Rule(WasteFact(is_moist=True, cv_label=MATCH.cv_label & P(lambda x: x in ['banana', 'apple', 'orange', 'carrot', 'broccoli', 'hot dog', 'pizza', 'donut', 'cake', 'sandwich'])), 
          salience=105)
    def rule_definitive_moist_food(self, cv_label):
        reason = f"Moisture sensor indicates high humidity AND visual detection confirms food item ('{cv_label}'). Definitive organic waste."
        self.add_candidate(WasteCategory.ORGANIC, 0.99, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(is_moist=True, humidity_percent=P(lambda h: h > 80)), salience=100)
    def rule_very_moist_organic(self):
        reason = "Very high moisture content (>80%). Strong indicator of organic waste or wet food."
        self.add_candidate(WasteCategory.ORGANIC, 0.98, reason, "Organic Waste / Compost Bin")

    # =========================================================================
    # PRIORITY 2: HIGH-CONFIDENCE VISUAL RULES (Salience 90-99)
    # =========================================================================

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['banana', 'apple', 'orange', 'carrot', 'broccoli']), 
                    cv_confidence=P(lambda c: c > 0.8)), salience=98)
    def rule_high_confidence_fresh_food(self, cv_label):
        reason = f"High confidence visual detection of fresh produce ('{cv_label}')."
        self.add_candidate(WasteCategory.ORGANIC, 0.97, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['hot dog', 'pizza', 'donut', 'cake', 'sandwich']), 
                    cv_confidence=P(lambda c: c > 0.8)), salience=97)
    def rule_high_confidence_prepared_food(self, cv_label):
        reason = f"High confidence visual detection of prepared food ('{cv_label}')."
        self.add_candidate(WasteCategory.ORGANIC, 0.95, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(cv_label='book', cv_confidence=P(lambda c: c > 0.7)), salience=95)
    def rule_high_confidence_book(self):
        reason = "High confidence visual detection of a 'book' - clearly paper recyclable."
        self.add_candidate(WasteCategory.PAPER, 0.95, reason, "Paper Recycling Bin")

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['fork', 'knife', 'spoon', 'scissors']), 
                    cv_confidence=P(lambda c: c > 0.7)), salience=94)
    def rule_high_confidence_cutlery(self, cv_label):
        reason = f"High confidence visual detection of '{cv_label}' - typically metal utensils."
        self.add_candidate(WasteCategory.METAL, 0.93, reason, "Metal Recycling Bin")

    @Rule(WasteFact(cv_label='wine glass', cv_confidence=P(lambda c: c > 0.8)), salience=92)
    def rule_high_confidence_wine_glass(self):
        reason = "High confidence visual detection of 'wine glass' - clearly glass material."
        self.add_candidate(WasteCategory.GLASS, 0.95, reason, "Glass Recycling Bin")

    @Rule(WasteFact(cv_label='vase', cv_confidence=P(lambda c: c > 0.8)), salience=91)
    def rule_high_confidence_vase(self):
        reason = "High confidence visual detection of 'vase' - likely glass or ceramic."
        self.add_candidate(WasteCategory.GLASS, 0.85, reason, "Glass Recycling Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.7, "Could be ceramic vase", "Manual Inspection Bin")

    @Rule(WasteFact(cv_label='toothbrush', cv_confidence=P(lambda c: c > 0.7)), salience=90)
    def rule_high_confidence_toothbrush(self):
        reason = "High confidence visual detection of 'toothbrush' - typically plastic but not recyclable."
        self.add_candidate(WasteCategory.UNKNOWN, 0.9, reason, "Manual Inspection Bin")

    # =========================================================================
    # PRIORITY 3: SENSOR + VISION FUSION RULES (Salience 70-89)
    # =========================================================================

    @Rule(WasteFact(is_metal=False, is_transparent=True, cv_label='bottle', 
                    weight_grams=P(lambda w: w > 150)), salience=88)
    def rule_heavy_transparent_bottle(self):
        reason = "Fusion: Visually a 'bottle', transparent, not metal, and heavy (>150g). Strong evidence for glass bottle."
        self.add_candidate(WasteCategory.GLASS, 0.96, reason, "Glass Recycling Bin")

    @Rule(WasteFact(is_metal=False, is_transparent=True, cv_label='bottle', 
                    weight_grams=P(lambda w: 30 < w <= 150)), salience=87)
    def rule_medium_weight_transparent_bottle(self):
        reason = "Fusion: Visually a 'bottle', transparent, not metal, medium weight (30-150g). Likely plastic bottle."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.92, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(is_metal=False, cv_label='bottle', weight_grams=P(lambda w: w <= 30)), salience=86)
    def rule_very_light_bottle(self):
        reason = "Fusion: Visually a 'bottle', not metal, and very lightweight (≤30g). Definitely plastic."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.95, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(is_metal=False, is_transparent=True, cv_label=MATCH.cv_label & P(lambda x: x in ['cup', 'wine glass']), 
                    weight_grams=P(lambda w: w > 100)), salience=85)
    def rule_heavy_transparent_drinkware(self, cv_label):
        reason = f"Fusion: Visually '{cv_label}', transparent, not metal, and heavy (>100g). Strong evidence for glass."
        self.add_candidate(WasteCategory.GLASS, 0.94, reason, "Glass Recycling Bin")

    @Rule(WasteFact(is_metal=False, is_transparent=True, cv_label='cup', 
                    weight_grams=P(lambda w: w <= 100)), salience=84)
    def rule_light_transparent_cup(self):
        reason = "Fusion: Visually a 'cup', transparent, not metal, and lightweight (≤100g). Likely plastic cup."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.90, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(is_metal=False, is_transparent=False, cv_label='cup',
                    weight_grams=P(lambda w: w < 50), is_moist=False), salience=83)
    def rule_light_opaque_dry_cup(self):
        reason = "Fusion: Visually a 'cup', opaque, not metal, lightweight (<50g), and dry. Strong evidence for paper cup."
        self.add_candidate(WasteCategory.PAPER, 0.92, reason, "Paper Recycling Bin")

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['fork', 'knife', 'spoon']), is_metal=False,
                    weight_grams=P(lambda w: w < 10)), salience=82)
    def rule_lightweight_plastic_cutlery(self, cv_label):
        reason = f"Fusion: Visually '{cv_label}', not metal, very lightweight (<10g). Disposable plastic cutlery."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.85, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(cv_label='bowl', is_metal=False, weight_grams=P(lambda w: w < 30), 
                    is_moist=False), salience=81)
    def rule_light_dry_bowl(self):
        reason = "Fusion: Visually a 'bowl', not metal, lightweight (<30g), and dry. Could be paper or plastic bowl."
        self.add_candidate(WasteCategory.PAPER, 0.80, reason, "Paper Recycling Bin")
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.75, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(cv_label='bowl', is_metal=False, weight_grams=P(lambda w: w > 100)), salience=80)
    def rule_heavy_non_metal_bowl(self):
        reason = "Fusion: Visually a 'bowl', not metal, but heavy (>100g). Likely ceramic or thick glass."
        self.add_candidate(WasteCategory.GLASS, 0.70, reason, "Glass Recycling Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.85, "Could be ceramic bowl", "Manual Inspection Bin")

    @Rule(WasteFact(cv_label='vase', is_metal=False, is_transparent=True, 
                    weight_grams=P(lambda w: w > 200)), salience=79)
    def rule_heavy_transparent_vase(self):
        reason = "Fusion: Visually a 'vase', not metal, transparent, and heavy (>200g). Glass vase."
        self.add_candidate(WasteCategory.GLASS, 0.95, reason, "Glass Recycling Bin")

    @Rule(WasteFact(cv_label='vase', is_metal=False, is_transparent=False, 
                    weight_grams=P(lambda w: w > 300)), salience=78)
    def rule_heavy_opaque_vase(self):
        reason = "Fusion: Visually a 'vase', not metal, opaque, and very heavy (>300g). Likely ceramic vase."
        self.add_candidate(WasteCategory.UNKNOWN, 0.90, reason, "Manual Inspection Bin")

    @Rule(WasteFact(is_metal=False, is_moist=True, 
                    cv_label=MATCH.cv_label & P(lambda x: x not in ['banana', 'apple', 'orange', 'carrot', 'broccoli', 'hot dog', 'pizza', 'donut', 'cake', 'sandwich'])), salience=77)
    def rule_moist_non_food_item(self, cv_label):
        reason = f"Fusion: Item appears to be '{cv_label}' but is moist. Could be contaminated or wet waste."
        self.add_candidate(WasteCategory.ORGANIC, 0.70, reason, "Organic Waste / Compost Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.75, "Contaminated item needs inspection", "Manual Inspection Bin")

    @Rule(WasteFact(weight_grams=P(lambda w: w > 500), is_metal=False), salience=75)
    def rule_very_heavy_non_metal(self):
        reason = "Sensor-driven: Item is very heavy (>500g) but not metal. Could be ceramic, stone, or dense material."
        self.add_candidate(WasteCategory.UNKNOWN, 0.85, reason, "Manual Inspection Bin")

    @Rule(WasteFact(is_transparent=True, weight_grams=P(lambda w: w > 200), is_metal=False,
                    cv_label=MATCH.cv_label & P(lambda x: x not in ['bottle', 'cup', 'wine glass', 'vase'])), salience=74)
    def rule_heavy_transparent_unknown(self, cv_label):
        reason = f"Fusion: Item appears to be '{cv_label}', is transparent and heavy (>200g) but not metal. Likely glass but unusual shape."
        self.add_candidate(WasteCategory.GLASS, 0.80, reason, "Glass Recycling Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.70, "Unusual glass item", "Manual Inspection Bin")

    # =========================================================================
    # PRIORITY 4: MODERATE CONFIDENCE RULES (Salience 40-69)
    # =========================================================================

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['banana', 'apple', 'orange', 'carrot', 'broccoli']), 
                    cv_confidence=P(lambda c: 0.5 <= c <= 0.8)), salience=65)
    def rule_moderate_confidence_fresh_food(self, cv_label):
        reason = f"Moderate confidence visual detection of fresh produce ('{cv_label}'). Likely organic."
        self.add_candidate(WasteCategory.ORGANIC, 0.85, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['hot dog', 'pizza', 'donut', 'cake', 'sandwich']), 
                    cv_confidence=P(lambda c: 0.5 <= c <= 0.8)), salience=64)
    def rule_moderate_confidence_prepared_food(self, cv_label):
        reason = f"Moderate confidence visual detection of prepared food ('{cv_label}'). Likely organic."
        self.add_candidate(WasteCategory.ORGANIC, 0.80, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(is_metal=False, cv_label='bottle', cv_confidence=P(lambda c: c > 0.6)), salience=60)
    def rule_ambiguous_bottle_weight_unknown(self):
        reason = "Visual detection of 'bottle' with good confidence, not metal, but other sensors ambiguous."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.75, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.GLASS, 0.70, reason, "Glass Recycling Bin")
        
    @Rule(WasteFact(is_metal=False, cv_label='cup', cv_confidence=P(lambda c: c > 0.6)), salience=59)
    def rule_ambiguous_cup_material_unknown(self):
        reason = "Visual detection of 'cup' with good confidence, not metal, but material unclear."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.70, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.PAPER, 0.70, reason, "Paper Recycling Bin")
        self.add_candidate(WasteCategory.GLASS, 0.65, reason, "Glass Recycling Bin")

    @Rule(WasteFact(cv_label='bowl', is_metal=False, cv_confidence=P(lambda c: c > 0.6)), salience=58)
    def rule_ambiguous_bowl_material_unknown(self):
        reason = "Visual detection of 'bowl' with good confidence, not metal, but material unclear."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.65, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.PAPER, 0.65, reason, "Paper Recycling Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.70, "Could be ceramic bowl", "Manual Inspection Bin")

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['fork', 'knife', 'spoon']), is_metal=False,
                    cv_confidence=P(lambda c: c > 0.6)), salience=57)
    def rule_non_metal_cutlery_ambiguous(self, cv_label):
        reason = f"Visual detection of '{cv_label}' but not metal. Likely plastic disposable cutlery."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.80, reason, "Plastic (PET) Recycling Bin")

    @Rule(WasteFact(is_moist=True, cv_label=MATCH.cv_label & P(lambda x: x in ['book', 'toothbrush']), 
                    cv_confidence=P(lambda c: c > 0.5)), salience=55)
    def rule_moist_non_food_contaminated(self, cv_label):
        reason = f"Item appears to be '{cv_label}' but is moist. Likely contaminated and not recyclable."
        self.add_candidate(WasteCategory.UNKNOWN, 0.85, reason, "Manual Inspection Bin")

    # =========================================================================
    # PRIORITY 5: SENSOR-ONLY FALLBACK RULES (Salience 10-39)
    # =========================================================================

    @Rule(WasteFact(is_transparent=True, weight_grams=P(lambda w: w > 150), is_metal=False,
                    cv_label=P(lambda x: x == 'unknown' or x is None)), salience=35)
    def rule_sensor_only_heavy_transparent(self):
        reason = "Sensor-driven: No clear visual ID, but item is heavy (>150g), transparent, and not metal. Likely glass."
        self.add_candidate(WasteCategory.GLASS, 0.80, reason, "Glass Recycling Bin")

    @Rule(WasteFact(is_transparent=True, weight_grams=P(lambda w: w <= 150), is_metal=False,
                    cv_label=P(lambda x: x == 'unknown' or x is None)), salience=34)
    def rule_sensor_only_light_transparent(self):
        reason = "Sensor-driven: No clear visual ID, but item is lightweight (≤150g), transparent, and not metal. Likely plastic."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.75, reason, "Plastic (PET) Recycling Bin")

    # @Rule(WasteFact(is_transparent=False, weight_grams=P(lambda w: w < 100), is_metal=False, is_moist=False,
    #                 cv_label=P(lambda x: x == 'unknown' or x is None)), salience=33)
    # def rule_sensor_only_light_opaque_dry(self):
    #     reason = "Sensor-driven: No clear visual ID, but item is lightweight (<100g), opaque, dry, and not metal. Likely paper."
    #     self.add_candidate(WasteCategory.PAPER, 0.70, reason, "Paper Recycling Bin")

    @Rule(WasteFact(is_moist=True, cv_label=P(lambda x: x == 'unknown' or x is None)), salience=30)
    def rule_sensor_only_moist_unknown(self):
        reason = "Sensor-driven: No clear visual ID, but item is moist. Likely organic waste."
        self.add_candidate(WasteCategory.ORGANIC, 0.65, reason, "Organic Waste / Compost Bin")

    @Rule(WasteFact(weight_grams=P(lambda w: w > 300), is_metal=False,
                    cv_label=P(lambda x: x == 'unknown' or x is None)), salience=25)
    def rule_sensor_only_very_heavy_non_metal(self):
        reason = "Sensor-driven: No clear visual ID, but item is very heavy (>300g) and not metal. Needs manual inspection."
        self.add_candidate(WasteCategory.UNKNOWN, 0.80, reason, "Manual Inspection Bin")

    # =========================================================================
    # PRIORITY 6: LOW CONFIDENCE VISUAL RULES (Salience 1-9)
    # =========================================================================

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['bottle', 'cup', 'bowl']), 
                    cv_confidence=P(lambda c: 0.3 <= c < 0.5)), salience=5)
    def rule_low_confidence_container(self, cv_label):
        reason = f"Low confidence visual detection of '{cv_label}'. Could be various materials."
        self.add_candidate(WasteCategory.PLASTIC_PET, 0.60, reason, "Plastic (PET) Recycling Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.65, "Low confidence detection", "Manual Inspection Bin")

    @Rule(WasteFact(cv_label=MATCH.cv_label & P(lambda x: x in ['banana', 'apple', 'orange', 'carrot', 'broccoli', 'hot dog', 'pizza', 'donut', 'cake', 'sandwich']), 
                    cv_confidence=P(lambda c: 0.3 <= c < 0.5)), salience=4)
    def rule_low_confidence_food(self, cv_label):
        reason = f"Low confidence visual detection of food item ('{cv_label}'). Possibly organic."
        self.add_candidate(WasteCategory.ORGANIC, 0.60, reason, "Organic Waste / Compost Bin")
        self.add_candidate(WasteCategory.UNKNOWN, 0.55, "Uncertain food identification", "Manual Inspection Bin")

    # =========================================================================
    # PRIORITY 7: FINAL FALLBACK (Salience -1)
    # =========================================================================

    @Rule(salience=-1)
    def rule_final_fallback_unknown(self):
        if not self.candidates:
            if len(self.facts) > 1:
                fact = self.facts[1]
                cv_guess = fact.get('cv_label', 'unknown')
                cv_conf = fact.get('cv_confidence', 0.0)
                weight = fact.get('weight_grams', 'unknown')
                reason = f"No specific rules matched. Visual: '{cv_guess}' (conf: {cv_conf:.2f}), Weight: {weight}g. Manual inspection required."
            else:
                reason = "No specific rules matched and no WasteFact was found."
            self.add_candidate(WasteCategory.UNKNOWN, 0.5, reason, "Manual Inspection Bin")