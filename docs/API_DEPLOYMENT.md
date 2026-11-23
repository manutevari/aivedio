# AIVEDIO API Container

Build from the repository root (monorepo context):

```bash
docker build -f Dockerfile.api -t aivedio-api .
docker run --env-file .env -p 3000:3000 aivedio-api
```

The container starts only the API server. It does **not** automatically run database migrations.

Required environment:
- `DATABASE_URL`
- `AIVEDIO_SESSION_SECRET` (32+ characters)
- `AIVEDIO_ALLOW_SELF_REGISTRATION=true` if public registration is intended
- `AIVEDIO_ALLOWED_ORIGINS` (include `https://aivedio.streamlit.app` if API CORS applies to this origin)

Optional password reset:
- `RESEND_API_KEY`
- `AIVEDIO_EMAIL_FROM`
- `AIVEDIO_WEB_URL`

Health checks:
- `/health`: process health
- `/ready`: database readiness

Before first deployment, review and run migrations separately and deliberately:
```bash
pnpm --filter @ivedio/api test:migrate
```
Correct package filter is `@aivedio/api`:
```bash
pnpm --filter @aivedio/api test:migrate
```

For Streamlit Cloud, set `AIVEDIO_API_URL` in App → Settings → Secrets to the deployed API's HTTPS origin (no trailing slash). Do not set it to localhost.
