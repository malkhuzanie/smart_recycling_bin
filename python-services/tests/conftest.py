"""Test configuration and fixtures"""

import pytest
import sys
import logging
from pathlib import Path

src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from smart_bin.models.waste_types import WasteCategory, WasteClassification
from smart_bin.core.knowledge_engine import SmartBinKnowledgeEngine
from smart_bin.core.facts import WasteFact

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)8s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

@pytest.fixture(autouse=True)
def setup_test_logging():
    """Automatically set up logging for each test"""
    logger.info("=" * 60)
    logger.info("Starting new test")
    yield
    logger.info("Test completed")
    logger.info("=" * 60)

@pytest.fixture
def sample_classifications():
    """Sample classifications for testing"""
    classifications = [
        WasteClassification(
            category=WasteCategory.METAL,
            confidence=0.8,
            reasoning="Metal detected",
            disposal_location="Metal bin"
        ),
        WasteClassification(
            category=WasteCategory.PLASTIC_PET,
            confidence=0.9,
            reasoning="PET bottle detected",
            disposal_location="PET bin"
        ),
        WasteClassification(
            category=WasteCategory.HAZARDOUS,
            confidence=0.7,
            reasoning="Hazardous material",
            disposal_location="Hazardous facility"
        )
    ]
    
    logger.info(f"Created {len(classifications)} sample classifications:")
    for i, c in enumerate(classifications):
        logger.info(f"  {i+1}. {c.category.value} (confidence: {c.confidence})")
    
    return classifications

@pytest.fixture
def knowledge_engine():
    """Fresh knowledge engine for each test"""
    logger.info("Creating fresh knowledge engine")
    engine = SmartBinKnowledgeEngine()
    logger.info(f"Engine initialized with {len(engine.candidates)} candidates")
    return engine

@pytest.fixture
def sample_waste_facts():
    """Sample waste facts for testing"""
    facts = {
        'metal_can': WasteFact(
            cv_label='can',
            cv_confidence=0.8,
            is_metal=True,
            weight_grams=50
        ),
        'plastic_bottle': WasteFact(
            cv_label='plastic bottle',
            cv_confidence=0.9,
            is_transparent=True,
            weight_grams=25
        ),
        'banana_peel': WasteFact(
            cv_label='banana peel',
            cv_confidence=0.85,
            is_moist=True,
            weight_grams=80
        ),
        'battery': WasteFact(
            cv_label='battery',
            cv_confidence=0.75,
            is_metal=True,
            weight_grams=15
        ),
        'unknown_item': WasteFact(
            cv_label='unknown',
            cv_confidence=0.3,
            weight_grams=100
        )
    }
    
    logger.info(f"Created {len(facts)} sample waste facts:")
    for name, fact in facts.items():
        logger.info(f"  - {name}: {fact.cv_label} (confidence: {fact.cv_confidence})")
    
    return facts

