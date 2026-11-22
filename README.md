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

## Run locally
Requires Node.js 20+ and pnpm 9+.

```bash
pnpm install
pnpm dev
```

API health: http://localhost:3000/health

**Important:** Provider integrations, persistence, authentication, UI and production safety classifiers are not yet implemented. The safety interface deliberately returns uncertainty when no classifier is connected.
