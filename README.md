# AIVEDIO — Universal AI Creative Studio Foundation

Quality-first foundation for multimodal creative production: video, films, animation, images, music, voice, dialogue, sound effects, editing and rendering.

## Phase 1 foundation
- pnpm TypeScript workspace
- Fastify API
- Shared workflow contracts and node classifier
- Confidence/risk decision policy
- Free-only model routing contracts
- Flow project and scene models
- Fail-closed safety contract
- Checkpoint interfaces
- React/Vite UI
- Optional Streamlit UI adapter

## Run the Node API and React UI
Requires Node.js 20+ and pnpm 9+.

```bash
pnpm install
pnpm dev
```

API health: http://localhost:3000/health

## Run Streamlit UI
Requires Python 3.10+.

```bash
cd apps/streamlit
pip install -r requirements.txt
streamlit run app.py
```

Set `AIVEDIO_API_URL` to the API base URL when the API is running.

**Important:** Provider integrations, persistence, authentication, production safety classifiers and actual media generation are not yet implemented. The safety interface deliberately returns uncertainty when no classifier is connected.
