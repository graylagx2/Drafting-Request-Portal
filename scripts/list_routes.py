#!/usr/bin/env python3
"""
List all registered routes under /api/documents for the Kern-Energy-Nexus Flask app.
Loads create_app directly from app/__init__.py via importlib to avoid ModuleNotFoundError.
"""
import os
import sys
import importlib.util

# Determine script and project directories
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
app_init = os.path.join(project_root, 'app', '__init__.py')

if not os.path.isfile(app_init):
    sys.exit(
        "Error: app/__init__.py not found. Ensure 'app' and 'scripts' are siblings.")

# Make project root importable so that submodules under app/ work
sys.path.insert(0, project_root)

# Dynamically load the 'app' package from its __init__.py
spec = importlib.util.spec_from_file_location('app', app_init)
app_module = importlib.util.module_from_spec(spec)
sys.modules['app'] = app_module
spec.loader.exec_module(app_module)

# Extract the factory function
try:
    create_app = app_module.create_app
except AttributeError:
    sys.exit("Error: create_app() not defined in app/__init__.py")


def main():
    app = create_app()
    print("Registered /api/documents routes:")
    for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
        if rule.rule.startswith("/api/documents"):
            methods = ",".join(sorted(rule.methods - {"HEAD", "OPTIONS"}))
            print(f"{rule.rule}  [{methods}]")


if __name__ == "__main__":
    main()
