# AIVEDIO Asset Intelligence Worker

Queued Python worker for metadata and supported document extraction.

## Run
Set `DATABASE_URL` and `MEDIA_ROOT` (shared API storage convention), install `requirements.txt`, then run `python worker.py`.

Optional OCR requires the Tesseract executable. Video keyframes require FFmpeg and ffprobe. Vision, embeddings, scene boundary detection and transcription adapters are explicitly unavailable until configured; this worker does not fabricate outputs.

Production deployment still requires authenticated object storage, isolation, antivirus scanning, processing limits and lease renewal.
