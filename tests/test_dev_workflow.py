from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_dev_requirements_include_test_client_dependencies():
    requirements = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")

    assert "-r requirements.txt" in requirements
    assert "pytest" in requirements
    assert "httpx" in requirements


def test_verify_local_script_runs_backend_tests_and_frontend_build():
    script = (ROOT / "scripts" / "verify-local.sh").read_text(encoding="utf-8")

    assert "python3 -m pytest" in script
    assert "npm run build" in script
    assert "set -euo pipefail" in script


def test_readme_documents_local_verification_flow():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    assert "requirements-dev.txt" in readme
    assert "scripts/verify-local.sh" in readme
