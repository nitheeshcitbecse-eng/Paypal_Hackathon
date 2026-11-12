"""
Makes `import agentguard_ai` work when the engine is checked out in a folder with another name
(e.g. Paypal_Hackathon): registers the repository root as the `agentguard_ai` package.
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if "agentguard_ai" not in sys.modules:
    try:
        import agentguard_ai  # noqa: F401  (already importable, e.g. folder named agentguard_ai)
    except ImportError:
        spec = importlib.util.spec_from_file_location(
            "agentguard_ai", ROOT / "__init__.py", submodule_search_locations=[str(ROOT)]
        )
        module = importlib.util.module_from_spec(spec)
        sys.modules["agentguard_ai"] = module
        spec.loader.exec_module(module)
