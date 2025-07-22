"""Test decision resolver"""

import pytest
import logging
from smart_bin.core.resolver import DecisionResolver
from smart_bin.models.waste_types import WasteCategory, WasteClassification

class TestDecisionResolver:
    """Test the decision resolution logic"""
    
    @pytest.fixture
    def resolver(self):
        return DecisionResolver()
    
    def test_empty_candidates(self, resolver):
        """Test resolver with no candidates"""
        result = resolver.resolve_candidates([])
        assert result is None
        
    def test_single_candidate(self, resolver):
        """Test resolver with single candidate"""
        classification = WasteClassification(
            category=WasteCategory.METAL,
            confidence=0.8,
            reasoning="Single candidate",
            disposal_location="Metal bin"
        )
        
        result = resolver.resolve_candidates([classification])
        assert result == classification
        
    def test_priority_resolution(self, resolver, sample_classifications):
        """Test priority-based resolution - priority trumps confidence"""
        logger = logging.getLogger(__name__)
        
        logger.info("Testing priority-based resolution")
        logger.info("Input classifications:")
        for c in sample_classifications:
            priority = resolver.priority_order.get(c.category, 0)
            logger.info(f"  - {c.category.value}: confidence={c.confidence}, priority={priority}")
        
        # Given classifications with different priorities:
        # - Metal: confidence=0.8, priority=4  
        # - Plastic PET: confidence=0.9, priority=3
        # - Hazardous: confidence=0.7, priority=7
        
        result = resolver.resolve_candidates(sample_classifications)
        
        logger.info(f"Resolution result: {result.category.value} (confidence={result.confidence})")
        logger.info(f"Expected: hazardous waste should win due to highest priority (7)")
        
        # Hazardous should win with highest priority (7) despite lowest confidence (0.7)
        assert result.category == WasteCategory.HAZARDOUS
        assert result.confidence == 0.7  # Confirm it's the hazardous classification
        
        logger.info("✓ Priority resolution test passed")
        
    def test_confidence_resolution(self, resolver):
        """Test confidence-based resolution when priorities are equal"""
        classifications = [
            WasteClassification(
                category=WasteCategory.METAL,
                confidence=0.7,
                reasoning="Lower confidence metal",
                disposal_location="Metal bin"
            ),
            WasteClassification(
                category=WasteCategory.ORGANIC,  # Same priority as metal (4)
                confidence=0.9,
                reasoning="Higher confidence organic",
                disposal_location="Organic bin"
            )
        ]
        
        result = resolver.resolve_candidates(classifications)
        # With equal priority (both=4), higher confidence should win
        assert result.category == WasteCategory.ORGANIC
        assert result.confidence == 0.9
        
    def test_priority_order_uses_enum(self, resolver):
        """Test that priority order uses WasteCategory enum, not strings"""
        # Verify that all priority keys are WasteCategory enum values
        for category in resolver.priority_order.keys():
            assert isinstance(category, WasteCategory)
            
        # Verify specific priorities match expected values
        assert resolver.priority_order[WasteCategory.HAZARDOUS] == 7
        assert resolver.priority_order[WasteCategory.EWASTE] == 6
        assert resolver.priority_order[WasteCategory.UNKNOWN] == 0
        
    def test_priority_beats_confidence(self, resolver):
        """Test that priority always beats confidence"""
        # Create classifications where lower confidence has higher priority
        classifications = [
            WasteClassification(
                category=WasteCategory.PAPER,      # Priority=3, Confidence=0.95
                confidence=0.95,
                reasoning="Very confident paper",
                disposal_location="Paper bin"
            ),
            WasteClassification(
                category=WasteCategory.EWASTE,     # Priority=6, Confidence=0.6  
                confidence=0.6,
                reasoning="Low confidence e-waste",
                disposal_location="E-waste bin"
            )
        ]
        
        result = resolver.resolve_candidates(classifications)
        # E-waste should win due to higher priority (6 > 3) despite lower confidence (0.6 < 0.95)
        assert result.category == WasteCategory.EWASTE
        assert result.confidence == 0.6

