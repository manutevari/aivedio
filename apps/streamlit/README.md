# AIVEDIO Streamlit UI

Optional Python-first UI. It is intentionally separate from the React/Vite frontend and can be run independently.

## Run
```bash
python -m venv .venv
# activate the environment
pip install -r requirements.txt
streamlit run app.py
```

Configure `AIVEDIO_API_URL` (default `http://localhost:3000`) to connect to the Node API. The UI gracefully shows offline status if the API is unavailable.

This is a UI foundation only: generation, persistent projects, authentication, and production safety classification are not yet connected.
