# AIVEDIO Streamlit UI

Optional Python-first UI. It is intentionally separate from the React/Vite frontend and can be run independently.

## Run
```bash
python -m venv .venv
# activate the environment
pip install -r requirements.txt
streamlit run app.py
```

Configure `AIVEDIO_API_URL` (default `http://localhost:3000`) to connect to the Node API. The UI gracefully shows offline status if the API is unavailable. It reads the API base URL from Streamlit secrets first, then the `AIVEDIO_API_URL` environment variable.

This is a UI foundation only: generation, persistent projects, authentication, and production safety classification are not yet connected.

## Streamlit Cloud secrets

The Streamlit UI is a client of the AIVEDIO API. **Do not put provider keys in Streamlit secrets**; keep them on the API server.

Minimum Streamlit secrets:

```toml
AIVEDIO_API_URL = "https://your-api-host.example"
```

If you use Streamlit Cloud, add this in **App → Settings → Secrets**. For local development, use `~/.streamlit/secrets.toml` (or environment variables). The app currently reads `AIVEDIO_API_URL` from the environment; set that in the Streamlit app's deployment configuration.

## Server-side keys/configuration (API deployment)

- `OPENROUTER_API_KEY` — Improvisor, Implementation Agent, Auditor and Patcher LLM calls.
- `RESEND_API_KEY` — password-reset email delivery.
- `AIVEDIO_EMAIL_FROM` — verified sender address/domain for Resend.
- `AIVEDIO_SESSION_SECRET` — session/password-reset token HMAC secret (at least 32 characters).
- `AIVEDIO_BOOTSTRAP_ADMIN_KEY` — one-time first-admin bootstrap key (at least 32 characters).
- `AIVEDIO_ALLOW_SELF_REGISTRATION` — set to `true` to enable registration.
- `AIVEDIO_ALLOWED_ORIGINS` — exact allowed origins for API CORS.
- `AIVEDIO_WEB_URL` — frontend origin used in reset links.
- `AIVEDIO_API_URL` — API base URL for Streamlit.
- `OPENROUTER_AGENT_MODEL` — optional model override; default `openrouter/auto`.
- `TAVILY_API_KEY` — optional research integration, if enabled.

Never expose any of these secret values in logs, browser JavaScript, screenshots, or Git.
