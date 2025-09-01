from setuptools import setup, find_packages

setup(
    name="smart-recycling-bin",
    version="1.0.0",
    description="Expert system for intelligent waste classification",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "experta>=1.9.4",
    ],
    python_requires=">=3.7",
    entry_points={
        "console_scripts": [
            "smart-bin=smart_bin.interfaces.cli:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
