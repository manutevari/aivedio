# Run AIVEDIO Video QA Worker in Termux (Android)

Termux can run the Python worker directly for development/smoke testing. Android is not recommended as a reliable 24/7 production worker due to battery optimization, background process limits, and network changes.

## 1. Install Termux
Use a current Termux build from F-Droid or the official GitHub releases. Open Termux and run:

```sh
pkg update && pkg upgrade -y
pkg install -y python git ffmpeg
termux-setup-storage
```

Grant the storage permission when Android prompts.

## 2. Get the repo
```sh
git clone https://github.com/manutevari/aivedio.git
cd aivedio/apps/qa-worker
python -m pip install --upgrade pip
python -m pip install 'psycopg[binary]>=3.2,<4'
```

## 3. Configure a staging database only
Get an isolated staging/test PostgreSQL connection string. Do not use production: this worker continuously claims queued jobs and writes reports/reviews.

Set the environment for the current Termux session (replace the value locally; do not paste it into chat or commit it):

```sh
export DATABASE_URL='YOUR_STAGING_DATABASE_URL'
export MEDIA_ROOT="$HOME/aivedio-media"
export QA_WORKER_POLL_SECONDS=5
export QA_WORKER_ID="termux-qa-$(hostname)-$(date +%s)"
mkdir -p "$MEDIA_ROOT"
```

For a PostgreSQL URL from a hosted database, ensure TLS is enabled (often `sslmode=require` in the URL).

## 4. Put test media in the expected storage location
The worker reads each asset's `storage_key` relative to `MEDIA_ROOT`. The file path must match that key and the database asset row must point to a test project. For example, if the storage key is `test/sample.mp4`, place it at:

```
$HOME/aivedio-media/test/sample.mp4
```

Do not create a QA job against real/production assets.

## 5. Run
```sh
python worker.py
```

Logs should show the worker ID, then either polling quietly or a job processed. If `DATABASE_URL missing` appears, re-check the export. If connection errors appear, check URL, TLS, database network allow-list and credentials.

## 6. Stop
Press `Ctrl+C`. Worker exits after interrupting the loop. If Android kills Termux, it may stop without graceful shutdown.

## Optional: keep session awake during a test
```sh
pkg install termux-api
termux-wake-lock
```
Install the Termux:API Android app as well if using wake-lock functionality. Release when finished:

```sh
termux-wake-unlock
```

## Safety limitation
Current worker performs technical checks (FFprobe metadata, black-frame detection and basic findings); safety classification is explicitly unavailable and requires HITL review. Do not treat its score as an autonomous safety approval.
