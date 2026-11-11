# ReUse Campus — Full-stack student marketplace

This project keeps the original ReUse Campus visual direction and adds a working full-stack foundation:
- React + Vite frontend
- Express REST API
- PostgreSQL database
- Prisma ORM and migrations
- Registration, login and JWT-protected routes
- bcrypt password hashing
- Listing create/read/update/delete with owner checks
- Search, category/mode filters and price sorting
- Optional item photo upload (4 MB max; JPG/PNG/WEBP/GIF)
- Request creation, owner approval/rejection, requester cancellation and completion
- Dashboard counts from PostgreSQL
- Demo seed data

## 1. Prerequisites

Install these on your Windows machine:
- Node.js 18+ (Node 20 LTS is a good choice)
- PostgreSQL 14+ and pgAdmin (pgAdmin is optional)
- VS Code

## 2. Create the PostgreSQL database

Open pgAdmin, connect to your local PostgreSQL server, right-click **Databases → Create → Database**, and name it:

`reuse_campus`

Alternatively, in a terminal where PostgreSQL command-line tools are available:

```bash
createdb -U postgres reuse_campus
```

## 3. Configure the backend

Open a terminal in the `server` folder:

```bash
cd server
```

Copy `.env.example` to `.env`. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `server/.env` and replace `YOUR_POSTGRES_PASSWORD` with the password you chose when installing PostgreSQL. Set `JWT_SECRET` to a long random string (at least 32 characters).

Example:

```env
DATABASE_URL="postgresql://postgres:YOUR_REAL_PASSWORD@localhost:5432/reuse_campus?schema=public"
JWT_SECRET="put-a-long-random-secret-here-at-least-32-characters"
CLIENT_ORIGIN="http://localhost:5173"
PORT=4000
```

If your PostgreSQL username is not `postgres`, change that part too. If your server uses a port other than 5432, update it.

## 4. Install backend packages and create tables

Still inside `server`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run db:seed
```

The migration command creates the database tables from `server/prisma/schema.prisma`. The seed command adds sample listings and demo users.

Demo login after seeding:

- Email: `aarav.demo@srmist.edu.in`
- Password: `DemoPass123!`

This is a demo account. Do not use its password outside this local project.

## 5. Start the backend

In the `server` folder:

```bash
npm run dev
```

Keep this terminal running. The API should start at `http://localhost:4000`.

Check it in a browser:

`http://localhost:4000/api/health`

Expected response:

```json
{"status":"ok","service":"ReUse Campus API"}
```

## 6. Start the React frontend

Open a **second terminal** in the project root (`ReUse-Campus-FullStack`, not `server`):

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

Register a new account or use the seeded demo account.

## 7. Suggested project-review demo

1. Register a new student account.
2. Browse and search for a calculator.
3. Create a listing, optionally attach an image.
4. Sign out and sign in as another account (or use a second browser/incognito window).
5. Open the listing and send a request.
6. Sign back in as the listing owner and open **My requests**.
7. Approve or reject the request.
8. Mark an approved request completed to close the transaction (borrowed items become available again).
9. Open Dashboard to show database-backed counts.

## API routes

| Method | Endpoint | Auth | Purpose |
|---|---|---:|---|
| GET | `/api/health` | No | API health check |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| GET | `/api/auth/me` | Yes | Current account |
| GET | `/api/items` | No | Search/filter available items |
| GET | `/api/items/:id` | No | Item details |
| GET | `/api/items/mine` | Yes | Current user's listings |
| POST | `/api/items` | Yes | Create listing (multipart form for optional image) |
| PATCH | `/api/items/:id` | Yes | Edit own listing |
| DELETE | `/api/items/:id` | Yes | Delete own listing |
| GET | `/api/requests` | Yes | Requests sent and received |
| POST | `/api/requests` | Yes | Request an item |
| PATCH | `/api/requests/:id/status` | Yes | Approve/reject/cancel/complete |
| GET | `/api/dashboard` | Yes | Marketplace statistics |

Protected routes expect `Authorization: Bearer <JWT>`.

## Project structure

```text
ReUse-Campus-FullStack/
├── src/
│   ├── main.jsx
│   └── styles.css
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── db.js
│   │   └── index.js
│   ├── uploads/
│   ├── .env.example
│   └── package.json
├── index.html
├── package.json
└── vite.config.js
```

## Important limitations before public deployment

This is a local review/demo implementation, not a production-ready campus service. It uses JWT stored in browser localStorage, local disk for uploaded images, and does not yet include email verification, password reset, campus-domain verification, moderation, chat, notifications, cloud image storage, HTTPS deployment or automated tests. Do not put real student personal information into a publicly exposed deployment until those protections are added.
