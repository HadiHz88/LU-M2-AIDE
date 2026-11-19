"""Deploy server: receives GitHub webhooks (through ngrok) and redeploys the app.

When the CI/CD workflow finishes successfully on main, GitHub calls POST /deploy.
This server checks the request really comes from GitHub, then runs:
    docker compose -f <COMPOSE_FILE> pull
    docker compose -f <COMPOSE_FILE> up -d

Works on macOS and Windows. Python 3.10+, standard library only (no pip install).
"""
import hashlib
import hmac
import json
import os
import shutil
import subprocess
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Settings come from environment variables (see the guide for how to set them).
SECRET = os.environ.get("WEBHOOK_SECRET", "")
COMPOSE_FILE = os.environ.get("COMPOSE_FILE", "docker-compose.deploy.yml")
WORKFLOW_NAME = os.environ.get("WORKFLOW_NAME", "CI/CD")
BRANCH = os.environ.get("BRANCH", "main")
PORT = int(os.environ.get("PORT", "9000"))

deploy_lock = threading.Lock()  # one deploy at a time; a second one waits its turn


def log(message):
    print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)


def signature_ok(body, header):
    """GitHub signs each delivery with the webhook secret (HMAC-SHA256)."""
    expected = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header or "")


def run(args):
    log("Running: " + " ".join(args))
    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace")
    output = (result.stdout + result.stderr).strip()
    if output:
        print(output, flush=True)
    return result.returncode == 0


def deploy(commit):
    with deploy_lock:
        log(f"Deploying commit {commit[:7]}...")
        compose = ["docker", "compose", "-f", COMPOSE_FILE]
        if run(compose + ["pull"]) and run(compose + ["up", "-d"]):
            log(f"Deploy finished: commit {commit[:7]} is live on http://localhost:5173")
        else:
            log("Deploy FAILED (see the output above)")


def reason_to_ignore(payload):
    """Return why this workflow_run event should NOT trigger a deploy, or None."""
    run_info = payload.get("workflow_run", {})
    if payload.get("action") != "completed":
        return f"action is '{payload.get('action')}', waiting for 'completed'"
    if run_info.get("name") != WORKFLOW_NAME:
        return f"workflow '{run_info.get('name')}' is not '{WORKFLOW_NAME}'"
    if run_info.get("head_branch") != BRANCH:
        return f"branch '{run_info.get('head_branch')}' is not '{BRANCH}'"
    if run_info.get("conclusion") != "success":
        return f"workflow conclusion is '{run_info.get('conclusion')}'"
    return None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.reply(200, "Deploy server is running")  # handy check in a browser

    def do_POST(self):
        if self.path != "/deploy":
            return self.reply(404, "Not found")

        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not signature_ok(body, self.headers.get("X-Hub-Signature-256")):
            log("Rejected a request with an invalid signature")
            return self.reply(401, "Invalid signature")

        event = self.headers.get("X-GitHub-Event")
        if event == "ping":  # sent by GitHub when the webhook is created
            log("Ping from GitHub: the webhook is connected")
            return self.reply(200, "pong")
        if event != "workflow_run":
            return self.reply(202, f"Ignored event '{event}'")

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return self.reply(400, "Body is not JSON (set the webhook content type to application/json)")

        reason = reason_to_ignore(payload)
        if reason:
            log(f"Ignored: {reason}")
            return self.reply(202, f"Ignored: {reason}")

        # GitHub expects an answer within 10 seconds: deploy in the background.
        commit = payload["workflow_run"].get("head_sha", "")
        threading.Thread(target=deploy, args=(commit,), daemon=True).start()
        self.reply(202, "Deploy started")

    def reply(self, status, text):
        data = (text + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass  # silence the default per-request log lines; we log what matters


if __name__ == "__main__":
    if not SECRET:
        sys.exit("Set the WEBHOOK_SECRET environment variable first (see the guide).")
    if not shutil.which("docker"):
        log("Warning: 'docker' was not found. Is Docker Desktop installed and running?")
    if not os.path.isfile(COMPOSE_FILE):
        log(f"Warning: compose file not found: {COMPOSE_FILE}")

    log(f"Deploy server listening on http://localhost:{PORT} (GitHub calls POST /deploy)")
    log(f"Deploys successful '{WORKFLOW_NAME}' runs on '{BRANCH}' using {COMPOSE_FILE}")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        log("Stopped")
