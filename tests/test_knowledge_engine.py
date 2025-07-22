"""Test knowledge engine and rules"""

import pytest
import logging
from smart_bin.core.knowledge_engine import SmartBinKnowledgeEngine
from smart_bin.core.facts import WasteFact
from smart_bin.models.waste_types import WasteCategory

class TestKnowledgeEngine:
    """Test the expert system knowledge engine"""
    
    def test_engine_initialization(self, knowledge_engine):
        """Test engine initializes correctly"""
        assert len(knowledge_engine.candidates) == 0
        assert knowledge_engine.manual_override is None
        assert len(knowledge_engine.reasoning_trace) == 0
        
    def test_add_candidate(self, knowledge_engine):
        """Test adding classification candidates"""
        knowledge_engine.add_candidate(
            WasteCategory.METAL,
            0.8,
            "Test reasoning",
            "Test location"
        )
        
        assert len(knowledge_engine.candidates) == 1
        assert knowledge_engine.candidates[0].category == WasteCategory.METAL
        assert len(knowledge_engine.reasoning_trace) > 0
        
    def test_manual_override(self, knowledge_engine):
        """Test manual override functionality"""
        knowledge_engine.set_manual_override(
            WasteCategory.GLASS,
            "Glass bin",
            "User knows better"
        )
        
        assert knowledge_engine.manual_override is not None
        assert knowledge_engine.manual_override.category == WasteCategory.GLASS
        assert "User override" in knowledge_engine.manual_override.reasoning
        
    def test_reset_classification(self, knowledge_engine):
        """Test resetting the engine"""
        # Add some data
        knowledge_engine.add_candidate(WasteCategory.METAL, 0.8, "Test", "Test")
        knowledge_engine.set_manual_override(WasteCategory.GLASS, "Glass bin", "Test")
        
        # Reset
        knowledge_engine.reset_classification()
        
        assert len(knowledge_engine.candidates) == 0
        assert knowledge_engine.manual_override is None
        assert len(knowledge_engine.reasoning_trace) == 0

class TestRules:
    """Test individual rules in the knowledge engine"""
    
    def test_battery_rule(self, knowledge_engine, sample_waste_facts):
        """Test battery + metal rule (highest priority)"""
        logger = logging.getLogger(__name__)
        
        logger.info("Testing battery rule - should classify as e-waste")
        battery_fact = sample_waste_facts['battery']
        logger.info(f"Input fact: {battery_fact.cv_label} (confidence: {battery_fact.cv_confidence}, is_metal: {battery_fact.is_metal})")
        
        knowledge_engine.reset_classification()
        knowledge_engine.declare(battery_fact)
        
        logger.info("Running expert system...")
        knowledge_engine.run()
        
        decision = knowledge_engine.get_final_decision()
        logger.info(f"Final classification: {decision.final_classification.category.value}")
        logger.info(f"Number of candidates: {len(decision.candidates)}")
        logger.info(f"Reasoning: {decision.final_classification.reasoning}")
        
        assert decision.final_classification.category == WasteCategory.EWASTE
        logger.info("✓ Battery rule test passed")
        
    def test_metal_can_rule(self, knowledge_engine, sample_waste_facts):
        """Test metal can detection"""
        logger = logging.getLogger(__name__)
        
        logger.info("Testing metal can rule")
        can_fact = sample_waste_facts['metal_can']
        logger.info(f"Input fact: {can_fact.cv_label} (confidence: {can_fact.cv_confidence}, is_metal: {can_fact.is_metal})")
        
        knowledge_engine.reset_classification()
        knowledge_engine.declare(can_fact)
        knowledge_engine.run()
        
        decision = knowledge_engine.get_final_decision()
        logger.info(f"Final classification: {decision.final_classification.category.value}")
        logger.info(f"All candidates: {[c.category.value for c in decision.candidates]}")
        
        # Should be metal (either from can rule or metal sensor rule)
        assert decision.final_classification.category == WasteCategory.METAL
        logger.info("✓ Metal can rule test passed")
        
    def test_plastic_bottle_rule(self, knowledge_engine, sample_waste_facts):
        """Test plastic bottle detection"""
        knowledge_engine.reset_classification()
        knowledge_engine.declare(sample_waste_facts['plastic_bottle'])
        knowledge_engine.run()
        
        decision = knowledge_engine.get_final_decision()
        assert decision.final_classification.category == WasteCategory.PLASTIC_PET
        
    def test_organic_waste_rule(self, knowledge_engine, sample_waste_facts):
        """Test organic waste detection"""
        knowledge_engine.reset_classification()
        knowledge_engine.declare(sample_waste_facts['banana_peel'])
        knowledge_engine.run()
        
        decision = knowledge_engine.get_final_decision()
        assert decision.final_classification.category == WasteCategory.ORGANIC
        
    def test_fallback_rule(self, knowledge_engine, sample_waste_facts):
        """Test fallback rule for unknown items"""
        knowledge_engine.reset_classification()
        knowledge_engine.declare(sample_waste_facts['unknown_item'])
        knowledge_engine.run()
        
        decision = knowledge_engine.get_final_decision()
        assert decision.final_classification.category == WasteCategory.UNKNOWN

