"""Integration tests for the complete system"""

import pytest
from io import StringIO
import sys
from smart_bin.interfaces.cli import CLIInterface

class TestIntegration:
    """Test the complete system integration"""
    
    def test_complete_classification_workflow(self):
        """Test a complete classification from input to output"""
        cli = CLIInterface()
        
        # Test metal can classification
        cli.classify_waste(
            cv_label="can",
            cv_confidence=0.8,
            is_metal=True,
            is_moist=False,
            is_transparent=False,
            is_flexible=False,
            weight_grams=50
        )
        
        # Should have classified as metal
        decision = cli.engine.get_final_decision()
        assert decision.final_classification.category.value == "metal"
        assert len(decision.candidates) > 0
        
    def test_hazardous_waste_priority(self):
        """Test that hazardous waste gets priority"""
        cli = CLIInterface()
        
        # Paint can - should be hazardous despite being metal
        cli.classify_waste(
            cv_label="paint can",
            cv_confidence=0.8,
            is_metal=True,
            is_moist=False,
            is_transparent=False,
            is_flexible=False,
            weight_grams=200
        )
        
        decision = cli.engine.get_final_decision()
        assert decision.final_classification.category.value == "hazardous waste"
        
    def test_multiple_sensor_inputs(self):
        """Test classification with multiple sensor inputs"""
        cli = CLIInterface()
        
        # Plastic bottle with multiple confirmatory signals
        cli.classify_waste(
            cv_label="plastic bottle",
            cv_confidence=0.9,
            is_metal=False,
            is_moist=False,
            is_transparent=True,  
            is_flexible=False,
            weight_grams=25
        )
        
        decision = cli.engine.get_final_decision()
        assert decision.final_classification.category.value == "plastic (PET)"
        assert decision.confidence_score > 0.8

