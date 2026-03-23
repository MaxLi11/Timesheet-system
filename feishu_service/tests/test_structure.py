"""
Test Project Structure
测试项目结构
"""

import os
from pathlib import Path


def test_project_structure():
    """Test that all required directories exist"""
    base_dir = Path(__file__).parent.parent
    
    required_dirs = [
        "app",
        "app/models",
        "app/services",
        "app/api",
        "app/utils",
        "tests",
        "config",
    ]
    
    for dir_path in required_dirs:
        full_path = base_dir / dir_path
        assert full_path.exists(), f"Directory {dir_path} does not exist"
        assert full_path.is_dir(), f"{dir_path} is not a directory"


def test_required_files():
    """Test that all required files exist"""
    base_dir = Path(__file__).parent.parent
    
    required_files = [
        "README.md",
        "requirements.txt",
        ".gitignore",
        ".env.example",
        "app/__init__.py",
        "app/main.py",
        "config/config.example.yaml",
    ]
    
    for file_path in required_files:
        full_path = base_dir / file_path
        assert full_path.exists(), f"File {file_path} does not exist"
        assert full_path.is_file(), f"{file_path} is not a file"


def test_virtual_environment():
    """Test that virtual environment exists"""
    base_dir = Path(__file__).parent.parent
    venv_dir = base_dir / "venv"
    
    assert venv_dir.exists(), "Virtual environment directory does not exist"
    assert venv_dir.is_dir(), "venv is not a directory"
    
    # Check for Python executable in venv
    if os.name == "nt":  # Windows
        python_exe = venv_dir / "Scripts" / "python.exe"
    else:  # Linux/Mac
        python_exe = venv_dir / "bin" / "python"
    
    assert python_exe.exists(), "Python executable not found in virtual environment"


def test_gitignore_content():
    """Test that .gitignore contains essential patterns"""
    base_dir = Path(__file__).parent.parent
    gitignore_path = base_dir / ".gitignore"
    
    with open(gitignore_path, "r") as f:
        content = f.read()
    
    essential_patterns = [
        "__pycache__",
        "*.pyc",
        "venv/",
        ".env",
        "*.db",
        "*.log",
    ]
    
    for pattern in essential_patterns:
        assert pattern in content, f"Pattern '{pattern}' not found in .gitignore"


def test_requirements_content():
    """Test that requirements.txt contains essential packages"""
    base_dir = Path(__file__).parent.parent
    requirements_path = base_dir / "requirements.txt"
    
    with open(requirements_path, "r") as f:
        content = f.read()
    
    essential_packages = [
        "fastapi",
        "uvicorn",
        "lark-oapi",
        "sqlalchemy",
        "apscheduler",
        "pytest",
    ]
    
    for package in essential_packages:
        assert package in content, f"Package '{package}' not found in requirements.txt"
