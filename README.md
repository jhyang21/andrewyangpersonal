# Relora Personal Site

Waitlist-first personal site for Relora, with a separate About Andrew page.

## Routes

- `/` - Relora waitlist landing page
- `/about` - About Andrew
- `/privacy` - simple privacy page
- `/terms` - simple terms page
- `/api/waitlist` - waitlist submit endpoint

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Waitlist backend (Supabase Postgres)

The API route uses a direct Postgres connection and creates the `waitlist_signups` table automatically on first valid request.

Required environment variable:

- `POSTGRES_URL` (use the Supabase Transaction Pooler connection string)

Get this value from Supabase:

- Open your project dashboard.
- Go to **Connect** -> **Connection string** -> **Transaction pooler**.
- Copy the URI and use it as `POSTGRES_URL`.

Notes:

- Keep SSL enabled in the URL (`sslmode=require`).
- Pooler connections are recommended for serverless/API routes.

Optional local `.env.local` example:

```bash
POSTGRES_URL=postgres://...
```

### Table schema

```sql
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Design system

The UI follows a custom "Soft Index Card" visual language:

- Warm paper background and subtle card texture
- Persimmon primary accent for calls to action
- Juniper for calm metadata accents
- Fraunces for headlines, Inter for body/UI

Core tokens live in `src/app/globals.css`.
