# Construction CRM

A local-first cold-calling CRM for a 2-person team (Zain + Alejandro). Each person
runs the app on their own machine; both point at **one shared Postgres** so data stays
in sync. Built with Next.js (App Router) + Prisma + Tailwind.

## What it does

- **Dashboard** — your "Due Today / Overdue" follow-ups, with snooze (+1d / +7d) and dismiss.
- **Contacts** — manual CRUD, filterable by status / type / list / search. Each contact has a
  follow-up **cadence** and a **next follow-up** date.
- **Lists** — segment contacts into shared or private lists (yours vs. the team's).
- **Call mode** — work a list one contact at a time: tap **Let's Call** to start a live
  transcript, hit a one-tap **outcome** button (or keys 1–7), and it logs the call, sets the
  status, auto-schedules the next follow-up, and advances to the next contact.

## Setup

1. **Get a shared Postgres.** Create a free database at [neon.tech](https://neon.tech)
   (or Supabase). Copy the connection string.

2. **Configure the connection.** Put it in `.env`:
   ```
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"
   ```
   (Both you and Alejandro use the **same** `DATABASE_URL`.)

3. **Install + create the schema + seed users:**
   ```bash
   npm install
   npm run db:push      # creates tables on the shared DB
   npm run db:seed      # creates Zain + Alejandro + a few sample lists/contacts
   ```

4. **Run it:**
   ```bash
   npm run dev          # http://localhost:3000
   ```
   Open the app, click "I'm Zain" (or Alejandro), and go.

## Handy commands

| Command | What |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run db:push` | Sync the schema to the database (no migration files) |
| `npm run db:seed` | Seed users + sample data |
| `npm run db:studio` | Browse/edit the database in Prisma Studio |

## Notes & limitations

- **Live transcription** uses the browser **Web Speech API** — free and real-time, but
  **Chrome only**, and it captures **your microphone only** (not the other party). It is not
  private (audio is processed by the browser vendor). The transcript schema is provider-agnostic,
  so a paid streaming provider (Deepgram / OpenAI `gpt-4o-transcribe`) can be added later for
  full both-sides capture. Note: **Anthropic/Claude has no speech-to-text API**, so it can't do this.
- **Login** is a simple user picker (no password) — fine for a trusted local tool. Don't expose
  the app to the public internet.
- **Reminders** are in-app (the Dashboard) for now. An emailed daily digest (free, via Gmail SMTP +
  a scheduled GitHub Action) is planned but not built yet.
- **CSV import** of contacts is planned but not built yet — add contacts manually for now.

## Stack

Next.js 16 · React 19 · Prisma 7 (pg driver adapter) · PostgreSQL · Tailwind v4 · TypeScript
