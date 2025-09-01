"""Test data models"""

import pytest
from smart_bin.models.waste_types import WasteCategory, WasteClassification
from smart_bin.models.sensors import CVReading, PhysicalSensorReading
from smart_bin.models.decisions import ClassificationDecision

class TestWasteTypes:
    """Test waste type models"""
    
    def test_waste_category_enum(self):
        """Test WasteCategory enum values"""
        assert WasteCategory.METAL.value == "metal"
        assert WasteCategory.PLASTIC_PET.value == "plastic (PET)"
        assert WasteCategory.HAZARDOUS.value == "hazardous waste"
        
    def test_waste_classification_creation(self):
        """Test WasteClassification dataclass"""
        classification = WasteClassification(
            category=WasteCategory.METAL,
            confidence=0.8,
            reasoning="Test reasoning",
            disposal_location="Test location"
        )
        
        assert classification.category == WasteCategory.METAL
        assert classification.confidence == 0.8
        assert classification.reasoning == "Test reasoning"
        assert classification.disposal_location == "Test location"
        assert classification.priority_score == 0  

class TestSensorModels:
    """Test sensor data models"""
    
    def test_cv_reading(self):
        """Test computer vision reading"""
        cv_reading = CVReading(
            label="bottle",
            cv_confidence=0.9,
            sensor_type="",  
            value="",       
            confidence=0.0 
        )
        
        assert cv_reading.sensor_type == "computer_vision"
        assert cv_reading.value == "bottle"
        assert cv_reading.confidence == 0.9
        
    def test_physical_sensor_reading(self):
        """Test physical sensor reading"""
        sensor_reading = PhysicalSensorReading(
            sensor_type="metal_detector",
            value=True,
            confidence=0.95
        )
        
        assert sensor_reading.sensor_type == "metal_detector"
        assert sensor_reading.value is True
        assert sensor_reading.confidence == 0.95
        assert sensor_reading.timestamp is not None

class TestDecisionModels:
    """Test decision models"""
    
    def test_classification_decision(self, sample_classifications):
        """Test classification decision creation"""
        decision = ClassificationDecision(
            final_classification=sample_classifications[0],
            candidates=sample_classifications,
            reasoning_trace=["Rule 1 fired", "Rule 2 fired"]
        )
        
        assert decision.final_classification == sample_classifications[0]
        assert len(decision.candidates) == 3
        assert not decision.is_manual_override
        assert decision.confidence_score == 0.8

