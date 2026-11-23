# AIVEDIO API Deployment

## Preferred deployment: container host

The API is a Fastify service in a PNPM workspace and depends on the local `@aivedio/core` workspace package. Build from the repository root (monorepo context):

```bash
docker build -f Dockerfile.api -t aivedio-api .
docker run --env-file .env -p 3000:3000 aivedio-api
```

The Dockerfile uses Node 22 and PNPM 10.26.1, builds the core package and API, and starts the compiled Node output (not a dev TypeScript runner).

The container does **not** automatically run database migrations.

Required environment:
- `DATABASE_URL`
- `AIVEDIO_SESSION_SECRET` (32+ characters)
- `AIVEDIO_ALLOWED_ORIGINS` (exact origins, comma-separated; include Streamlit and web frontend origins)
- `AIVEDIO_ALLOW_SELF_REGISTRATION=true` only if public registration is intended

Optional password reset:
- `RESEND_API_KEY`
- `AIVEDIO_EMAIL_FROM`
- `AIVEDIO_WEB_URL`

Health checks:
- `/health`: process health
- `/ready`: database readiness

Before first deployment, review migrations and run them separately and deliberately:
```bash
pnpm --filter @aivedio/api test:migrate
```

## Vercel API project

Set Vercel project Root Directory to `apps/api`, enable source files outside root for workspace dependency access, and use Node 22. The project uses `apps/api/api/index.ts` as the serverless entrypoint and rewrites requests to it.

Do not mark the API ready until a deployed HTTPS URL returns JSON from `/health` and `/ready`.

## Client configuration

Streamlit Cloud → App → Settings → Secrets:
```toml
AIVEDIO_API_URL = "https://<verified-api-origin>"
```

Vercel frontend environment:
```
VITE_AIVEDIO_API_URL=https://<verified-api-origin>
```

Never use the Streamlit frontend URL as the API URL. Do not enter an unverified/example API URL.
