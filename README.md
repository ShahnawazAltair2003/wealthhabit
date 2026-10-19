# WealthHabit - Financial Habit Builder & Wealth Growth Tracker
Full-stack app: Node.js + Express + SQLite (better-sqlite3), JWT auth, bcrypt, Helmet, rate limiting, Chart.js frontend (7 hash-routed pages).

## Requirements
Node.js 22.13+ (22 LTS or 24 recommended). Check with `node -v`. The database uses Node's built-in SQLite, so no native modules are compiled.
If you must use older Node, run `npm install` (installs the optional better-sqlite3) and set `DB_DRIVER=better` in `.env`.

## Run locally
    cp .env.example .env   # a ready .env is already included; change JWT_SECRET for production
    npm install && npm start      # http://localhost:3000
Demo user `demo@wealthhabit.com / Demo@1234` - Admin `admin@wealthhabit.com / Admin@1234` .

## Deploy (Render - free)
1. Push this folder to GitHub. 2. Render -> New Web Service -> select repo.
3. Build: `npm install` | Start: `npm start` | Env: `JWT_SECRET=<long random string>`.
4. For persistent data add a Disk mounted at `/data` and set `DB_PATH=/data/data.db`.
5. Submit the resulting https://<name>.onrender.com link.

## Email setup (Contact form + Support)
Messages are always saved and shown in the Admin Panel. To also receive them by email, fill these in `.env`:
`SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, CONTACT_TO` (Gmail: enable 2-step verification and create an App Password).

## Pages
Home (React, `/`) - Vision - Contact - 
Login (login.html) - Register (register.html) - Dashboard - Expense Tracker - Habit Tracker - Savings Goals - Wealth Analytics - Admin Panel


## Live Website Rendered on render.com
 <ahref>https://wealthhabit.onrender.com/</a>