import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("runner", Path(__file__).resolve().parent.parent / "scripts/run-pr-agent-review.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ReviewEnvironmentTest(unittest.TestCase):
    def test_diagnostics_never_return_provider_text_or_credentials(self):
        self.assertEqual(runner.failure_categories("RateLimitError: secret-key raw provider body"), "quota")
        self.assertEqual(runner.failure_categories("unrecognized secret-key raw provider body"), "unclassified upstream failure")

    def test_credentials_and_runner_command_files_are_not_forwarded(self):
        source = {"PATH": "runtime", "GITHUB_TOKEN": "github-secret", "SUPERTHREAD_API_TOKEN": "ticket-secret", "GITHUB_ENV": "commands", "PR_AGENT_GEMINI_KEY": "model-secret", "OPENAI_API_KEY": "unrelated"}
        environment = runner.model_environment(source, "gemini/fixture")
        for key in ("GITHUB_TOKEN", "SUPERTHREAD_API_TOKEN", "GITHUB_ENV", "OPENAI_API_KEY"):
            self.assertNotIn(key, environment)
        self.assertEqual(environment["GOOGLE_AI_STUDIO.GEMINI_API_KEY"], "model-secret")
        self.assertEqual(environment["CONFIG.USE_REPO_SETTINGS_FILE"], "false")
        self.assertEqual(environment["CONFIG.FALLBACK_MODELS"], "[]")


if __name__ == "__main__":
    unittest.main()
