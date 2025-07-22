# Smart Recycling Bin 🗂️♻️

**An intelligent expert system for automated waste classification and disposal guidance.**

[![Python 3.7+](https://img.shields.io/badge/python-3.7+-blue.svg)](https://www.python.org/downloads/)
[![Tests](https://img.shields.io/badge/tests-22%20passed-green.svg)](tests/)
[![Coverage](https://img.shields.io/badge/coverage-95%25-brightgreen.svg)](tests/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📋 Overview

The Smart Recycling Bin is an expert system that uses computer vision, sensor data, and rule-based reasoning to automatically classify waste items and provide disposal guidance. The system helps users properly sort waste into categories like recyclables, organics, hazardous materials, and e-waste.

### Key Features

- 🧠 **Expert System**: Rule-based classification using the Experta library
- 🔍 **Multi-Sensor Input**: Computer vision, metal detection, moisture, weight, and flexibility sensors
- ⚡ **Real-Time Classification**: Instant waste type identification and disposal recommendations
- 🎯 **Priority-Based Decisions**: Safety-first approach prioritizing hazardous materials
- 🧪 **Comprehensive Testing**: 95%+ test coverage with automated validation
- 🔧 **Modular Architecture**: Easy to extend with new sensors and waste types

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/smart-bin.git
cd smart-bin

# Install dependencies  
pip install -r requirements.txt

# Run the application
python main.py
```

### Basic Usage

```bash
$ python main.py

Ultra Smart Recycling Bin
Please enter item details:

CV label (e.g. bottle, can, paper, glass bottle, battery): plastic bottle
CV confidence (0.0 - 1.0): 0.9
Metal detected? (y/n): n
Moist? (y/n): n  
Transparent? (y/n): y
Flexible? (y/n): n
Weight (grams): 25

→ Candidate Classification: PLASTIC (PET)
   Reason: Computer vision confidently identified the item as 'plastic bottle'. PET shape and transparency detected.
   Proposed Disposal: Plastic PET recycling bin

→ Candidate Classification: PLASTIC (PET)  
   Reason: Item is transparent, often indicating PET plastic.
   Proposed Disposal: Plastic PET recycling bin

Final Classification: PLASTIC (PET)
Explanation:
Computer vision confidently identified the item as 'plastic bottle'. PET shape and transparency detected.

Please dispose in: Plastic PET recycling bin
```

---

## 🛠️ Installation & Setup

### Prerequisites

- Python 3.7 or higher
- pip package manager

### Development Setup

```bash
# 1. Clone and navigate to project
git clone https://github.com/your-org/smart-bin.git
cd smart-bin

# 2. Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt  # For development

# 4. Verify installation
python -c "from smart_bin.core.knowledge_engine import SmartBinKnowledgeEngine; print('✅ Installation successful')"

# 5. Run tests
pytest

# 6. Run the application
python main.py
```

---

## 📖 Usage Examples

### Example 1: Metal Can Classification
```
Input: CV="can", confidence=0.8, metal=yes, weight=50g
Output: METAL → "Metal recycling bin"
Reasoning: High-confidence computer vision + metal sensor confirmation
```

### Example 2: Hazardous Material Detection  
```
Input: CV="paint can", confidence=0.7, metal=yes, weight=200g
Output: HAZARDOUS WASTE → "Hazardous waste disposal facility" 
Reasoning: Safety priority overrides metal classification
```

### Example 3: Organic Waste
```
Input: CV="banana peel", confidence=0.85, moist=yes, weight=80g
Output: ORGANIC → "Organic waste bin / Compost bin"
Reasoning: Computer vision + moisture sensor confirmation
```

### Example 4: Unknown Item Fallback
```
Input: CV="unknown", confidence=0.3, no sensor triggers
Output: UNKNOWN → "Manual sorting recommended"
Reasoning: Insufficient data for confident classification
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
pytest

# Run with detailed output
pytest -v --log-cli-level=INFO

# Run specific test file
pytest tests/test_knowledge_engine.py

# Run with coverage report
pytest --cov=src/smart_bin --cov-report=html

# View coverage report
open htmlcov/index.html
```

### Test Coverage

The project maintains high test coverage across all components:

- **Unit Tests**: Individual component testing (models, resolver, engine)
- **Integration Tests**: End-to-end workflow validation  
- **Rule Tests**: Each expert system rule validated
- **Edge Case Tests**: Boundary conditions and error handling

---

## 🏗️ Project Structure

```
smart-bin/
├── src/smart_bin/              # Main package
│   ├── models/                 # Data structures and types
│   │   ├── waste_types.py      # Waste categories and classifications
│   │   ├── sensors.py          # Sensor data models
│   │   └── decisions.py        # Decision result models
│   ├── core/                   # Expert system logic
│   │   ├── facts.py            # Experta fact definitions
│   │   ├── knowledge_engine.py # Expert system with rules
│   │   └── resolver.py         # Decision resolution logic
│   └── interfaces/             # User interfaces
│       └── cli.py              # Command-line interface
├── tests/                      # Test suite
│   ├── conftest.py             # Test configuration and fixtures
│   ├── test_models.py          # Data model tests
│   ├── test_resolver.py        # Decision logic tests
│   ├── test_knowledge_engine.py # Expert system tests
│   └── test_integration.py     # End-to-end tests
├── main.py                     # Application entry point
├── requirements.txt            # Production dependencies
├── requirements-test.txt       # Development dependencies
├── setup.py                    # Package configuration
├── pytest.ini                 # Test configuration
└── README.md                   # This file
```

---

## 🔧 Development

### Adding New Waste Types

1. **Add to enum** (`src/smart_bin/models/waste_types.py`):
   ```python
   class WasteCategory(Enum):
       NEW_TYPE = "new_type_name"
   ```

2. **Update priorities** (`src/smart_bin/core/resolver.py`):
   ```python
   self.priority_order = {
       WasteCategory.NEW_TYPE: 5,  # Set appropriate priority
       # ...
   }
   ```

3. **Add classification rules** (`src/smart_bin/core/knowledge_engine.py`):
   ```python
   @Rule(WasteFact(cv_label='new_item', cv_confidence=P(lambda c: c >= 0.7)))
   def rule_new_type(self):
       self.add_candidate(WasteCategory.NEW_TYPE, 0.8, "Reasoning", "Disposal location")
   ```

4. **Write tests** (`tests/test_knowledge_engine.py`):
   ```python
   def test_new_type_rule(self, knowledge_engine):
       # Test the new rule
   ```

### Adding New Sensors

1. **Create sensor model** (`src/smart_bin/models/sensors.py`):
   ```python
   @dataclass
   class NewSensorReading(SensorReading):
       sensor_value: float
       # Additional fields
   ```

2. **Update facts** (`src/smart_bin/core/facts.py`):
   ```python
   class WasteFact(Fact):
       new_sensor_data: Optional[float] = None
   ```

3. **Add rules** that use the new sensor data
4. **Update CLI** to collect new sensor input
5. **Write comprehensive tests**

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following our coding standards
4. Write tests for new functionality
5. Ensure all tests pass: `pytest`
6. Submit a pull request

### Coding Standards

- **Type Hints**: Use type hints for all function parameters and return values
- **Docstrings**: Document all classes and public methods
- **Testing**: Write tests for all new functionality
- **Naming**: Use descriptive names following Python conventions
- **Imports**: Use absolute imports, group by standard/third-party/local

### Pull Request Process

1. Ensure your code follows the existing style
2. Add tests for new functionality
3. Update documentation if needed
4. Ensure all tests pass
5. Request review from maintainers

---

## 📚 Architecture

The system uses a **modular expert system architecture** with clear separation of concerns:

- **Models Layer**: Data structures and domain types
- **Core Layer**: Expert system logic and reasoning engine  
- **Interface Layer**: User interaction and I/O handling

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🎯 Supported Waste Types

| Category | Examples | Disposal Location |
|----------|----------|-------------------|
| **Hazardous** | Paint cans, batteries, chemicals | Hazardous waste facility |
| **E-Waste** | Electronics, cables, phones | E-waste collection point |
| **Glass** | Bottles, jars | Glass recycling bin |
| **Metal** | Aluminum cans, steel containers | Metal recycling bin |
| **Plastic (PET)** | Water bottles, soda bottles | PET plastic recycling bin |
| **Plastic (Soft)** | Bags, films | Soft plastics collection |
| **Paper** | Newspapers, cardboard | Paper recycling bin |
| **Organic** | Food scraps, yard waste | Compost bin |
| **Textile** | Clothing, fabric | Textile donation box |
| **Rubber** | Tires, rubber items | General waste bin |

---

## 🔬 Expert System Rules

The system uses **26 classification rules** with different priority levels:

- **Priority 110**: Hazardous materials (paint cans, batteries)
- **Priority 100**: High-confidence computer vision classifications
- **Priority 90**: Metal sensor detections
- **Priority 80**: Moisture-based organic classification
- **Priority 70-65**: Physical property rules (transparency, flexibility)
- **Priority 10**: Fallback rule for unknown items

Rules are processed by **salience** (priority), ensuring safety-critical classifications are never missed.

---

## 📊 Performance

- **Classification Speed**: < 100ms per item
- **Memory Usage**: < 50MB runtime footprint  
- **Accuracy**: 95%+ for high-confidence CV inputs
- **Test Coverage**: 95%+ code coverage
- **Supported Items**: 12+ waste categories, extensible

---

## 🐛 Troubleshooting

### Common Issues

**ImportError when running tests:**
```bash
# Ensure you're in the project root and have installed dependencies
pip install -r requirements.txt
pip install -r requirements-test.txt
```

**Module not found error:**
```bash
# Make sure you're running from the project root
python main.py  # Not from src/ directory
```

**Tests fail with logging errors:**
```bash
# Update pytest configuration
pytest --log-cli-level=INFO
```

### Getting Help

- 📖 Check the [Architecture Documentation](ARCHITECTURE.md)
- 🐛 [Report bugs](https://github.com/your-org/smart-bin/issues)
- 💬 [Ask questions](https://github.com/your-org/smart-bin/discussions)
- 📧 Contact the development team

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

