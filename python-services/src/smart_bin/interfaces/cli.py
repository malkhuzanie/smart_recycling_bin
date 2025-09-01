from typing import Tuple
from ..core.knowledge_engine import SmartBinKnowledgeEngine
from ..core.facts import WasteFact
from ..models.waste_types import WasteCategory

class CLIInterface:
    """Command Line Interface for the smart bin"""
    
    def __init__(self):
        self.engine = SmartBinKnowledgeEngine()
        
    def get_user_input(self) -> Tuple[str, float, bool, bool, bool, bool, float]:
        """Get input from user (same as original implementation)"""
        print("Ultra Smart Recycling Bin\nPlease enter item details:")

        cv_label = input("CV label (e.g. bottle, can, paper, glass bottle, battery): ").strip().lower()
        try:
            cv_confidence = float(input("CV confidence (0.0 - 1.0): ").strip())
        except ValueError:
            cv_confidence = 0.5

        is_metal = input("Metal detected? (y/n): ").strip().lower() == 'y'
        is_moist = input("Moist? (y/n): ").strip().lower() == 'y'
        is_transparent = input("Transparent? (y/n): ").strip().lower() == 'y'
        is_flexible = input("Flexible? (y/n): ").strip().lower() == 'y'

        try:
            weight_grams = float(input("Weight (grams): ").strip())
        except ValueError:
            weight_grams = 0

        return cv_label, cv_confidence, is_metal, is_moist, is_transparent, is_flexible, weight_grams
    
    def classify_waste(self, cv_label: str, cv_confidence: float, is_metal: bool, 
                      is_moist: bool, is_transparent: bool, is_flexible: bool, 
                      weight_grams: float) -> None:
        """Classify waste item"""
        
        self.engine.reset_classification()
        
        waste_fact = WasteFact(
            cv_label=cv_label,
            cv_confidence=cv_confidence,
            is_metal=is_metal,
            is_moist=is_moist,
            is_transparent=is_transparent,
            is_flexible=is_flexible,
            weight_grams=weight_grams
        )
        
        self.engine.declare(waste_fact)
        self.engine.run()
        
        decision = self.engine.get_final_decision()
        self.display_result(decision)
        
    def display_result(self, decision) -> None:
        """Display classification result (same format as original)"""
        
        if decision.is_manual_override:
            print("\nManual override applied:")
        
        final = decision.final_classification
        if final:
            print(f"\nFinal Classification: {final.category.value.upper()}")
            print("Explanation:")
            print(final.reasoning)
            print(f"\nPlease dispose in: {final.disposal_location}")
        else:
            print("\nUnable to classify the item with confidence. Please sort manually.")
            
    def handle_manual_override(self) -> bool:
        """Handle manual override input"""
        override = input("\nWant to override the classification? (y/n): ").strip().lower()
        if override == 'y':
            new_class = input("Enter new classification: ").strip().lower()
            new_location = input("Enter new disposal location: ").strip()
            reason = input("Reason for override: ").strip()
            
            # Find matching category
            category = WasteCategory.UNKNOWN
            for cat in WasteCategory:
                if cat.value.lower() == new_class:
                    category = cat
                    break
            
            self.engine.set_manual_override(category, new_location, reason)
            decision = self.engine.get_final_decision()
            self.display_result(decision)
            return True
        return False
    
    def run(self) -> None:
        """Main CLI loop"""
        while True:
            try:
                cv_label, cv_confidence, is_metal, is_moist, is_transparent, is_flexible, weight_grams = self.get_user_input()
                
                self.classify_waste(cv_label, cv_confidence, is_metal, is_moist, is_transparent, is_flexible, weight_grams)
                
                self.handle_manual_override()
                
                continue_choice = input("\nClassify another item? (y/n): ").strip().lower()
                if continue_choice != 'y':
                    break
                    
            except KeyboardInterrupt:
                print("\nGoodbye!")
                break
            except Exception as e:
                print(f"\nError: {e}")
                print("Please try again.")


