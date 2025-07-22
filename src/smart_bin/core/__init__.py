"""Core expert system components"""

from .knowledge_engine import SmartBinKnowledgeEngine
from .facts import WasteFact
from .resolver import DecisionResolver

__all__ = [
    'SmartBinKnowledgeEngine',
    'WasteFact', 
    'DecisionResolver'
]

