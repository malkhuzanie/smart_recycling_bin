import sys
from pathlib import Path

src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

from smart_bin.interfaces.cli import CLIInterface

def main():
    """Main entry point"""
    try:
        cli = CLIInterface()
        cli.run()
    except Exception as e:
        print(f"Failed to start application: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

