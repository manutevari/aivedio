# Streamlit Adapter

AIVEDIO now has an optional Streamlit Python UI alongside the React UI.

## Architecture
- Streamlit is a UI adapter, not the orchestration engine.
- Node/Fastify remains the API/control plane.
- Python UI calls versioned API endpoints through HTTP.
- Shared concepts are mirrored using Python/Pydantic contracts as the Python worker layer grows.
- UI should never invoke providers directly; routing, free-only enforcement, safety and approvals belong to backend services.

## Local run
```bash
cd apps/streamlit
pip install -r requirements.txt
streamlit run app.py
```

Set `AIVEDIO_API_URL` to the API origin.

## Current state
Storyboard interactions and session-local scene edits work in the UI. The preview, generation, model-provider and timeline execution controls are intentionally placeholders pending API/provider implementation.
