# Image Studio

Image Studio is a self-hosted image generation and image editing workspace. The UI follows the Open WebUI pattern of a persistent left sidebar, central workspace, shared user/admin frontend, and role-gated admin views, but the product surface is specialized for image assets and multi-turn image workflows.

## Features

- Next.js App Router, TypeScript, Tailwind CSS.
- Prisma + PostgreSQL for users, sessions, turns, assets, usage events, and audit logs.
- Server-side OpenAI-compatible image provider adapter with per-user API keys and admin-configurable defaults.
- Local file storage mounted at `/data/uploads`.
- Login/register, interactive first-admin bootstrap, user/admin role checks.
- Image generation, image upload, image editing, retry, asset pool, and admin analytics.
- Docker Compose deployment for Ubuntu public servers.

## Security Notes

Do not put provider keys in `NEXT_PUBLIC_*` variables or frontend code. Each user should add their own provider key in Personal Settings; image generation and editing use the current user's key, not a shared administrator key. Administrator settings provide site defaults such as base URL, paths, model, and size. Saved keys are encrypted at rest and only returned as masked previews.

The key that was pasted into the planning conversation should be rotated before production use.

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Start PostgreSQL. The easiest path is Docker Compose:

```bash
docker compose up -d postgres
```

4. Keep `DATABASE_URL` pointed at `localhost` for host-based development, then push or migrate the schema:

```bash
npm run db:push
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

When the database has no users, the login screen switches to first-admin setup. The first registered account receives the `ADMIN` role automatically.

For provider-free UI testing, set:

```env
IMAGE_PROVIDER="mock"
```

## Ubuntu Deployment

1. Install Docker Engine and the Docker Compose plugin.
2. Copy the project to `/opt/image-studio`.
3. Create `.env.production` from `.env.example`.
4. Change `DATABASE_URL` to the Compose service hostname:

```env
DATABASE_URL="postgresql://image_studio:image_studio@postgres:5432/image_studio?schema=public"
```

5. Replace all secrets:
   - `JWT_SECRET`
   - `SETTINGS_ENCRYPTION_KEY`
   - `IMAGE_API_KEY` if you want environment-based provider configuration
   - PostgreSQL password if changed in Compose
6. Start the stack:

```bash
docker compose up -d --build
```

7. Confirm health:

```bash
curl http://127.0.0.1:3000/api/health
```

For public HTTPS, put Caddy or Nginx in front of the `web` service. The Compose file binds Next.js to `127.0.0.1:3000` so public traffic should enter through the reverse proxy. A starter Caddyfile is in `deploy/Caddyfile`; adjust the domain and DNS before use.

After the first administrator logs in, open the admin area and set Provider Settings. For general OpenAI-compatible deployments, choose `OpenAI-compatible`, enter the provider Base URL, generation/edit paths, default model/size, and API key. Leave `IMAGE_PROVIDER="mock"` only for local UI testing.

## Environment Variables

Important server-only variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `SETTINGS_ENCRYPTION_KEY`
- `SESSION_COOKIE_NAME`
- `ALLOW_REGISTRATION`
- `IMAGE_PROVIDER`
- `IMAGE_API_BASE_URL`
- `IMAGE_GENERATION_PATH`
- `IMAGE_EDIT_PATH`
- `IMAGE_API_KEY`
- `IMAGE_DEFAULT_MODEL`
- `IMAGE_DEFAULT_SIZE`
- `IMAGE_REQUEST_TIMEOUT_MS`
- `UPLOAD_DIR`
- `MAX_UPLOAD_MB`

## API Surface

- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/bootstrap`
- `GET /api/health`
- `GET /api/provider-settings`
- `PUT /api/provider-settings`
- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `GET /api/sessions/:id/assets`
- `POST /api/sessions/:id/assets/upload`
- `GET /api/sessions/:id/turns`
- `POST /api/sessions/:id/turns/generation`
- `POST /api/sessions/:id/turns/edit`
- `POST /api/turns/:id/retry`
- `GET /api/admin/analytics`
- `GET /api/admin/tasks`
- `GET /api/admin/users`
- `GET /api/admin/audit-logs`
- `GET /api/admin/provider-settings`
- `PUT /api/admin/provider-settings`

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Current MVP Limits

- Image tasks run synchronously inside the request.
- No brush-based mask editor yet.
- No S3/MinIO storage adapter yet.
- No billing or credit system yet.
- RBAC is role-based with `USER` and `ADMIN`, not custom permissions.
