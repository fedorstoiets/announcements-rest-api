# Announcements REST API

A TypeScript REST API for an announcements board. The project implements user authentication with JWT access/refresh tokens, refresh-token rotation, protected routes, announcement CRUD, ownership checks, pagination, search, sorting, validation, PostgreSQL persistence through Prisma, and OpenAPI/Swagger documentation.

## Author

**Fedor Stoietskyi**

## Technology Stack

- Node.js
- Express 5
- TypeScript
- PostgreSQL
- Prisma ORM
- Zod
- JSON Web Tokens (`jsonwebtoken`)
- bcrypt
- OpenAPI / Swagger UI

## Main Features

### Authentication

- User registration
- bcrypt password hashing
- Login with a generic `Invalid credentials` response for both invalid username and invalid password
- JWT access token valid for 15 minutes
- JWT refresh token valid for 7 days
- Refresh-token persistence in PostgreSQL
- Refresh-token rotation: a refresh token becomes invalid immediately after it is used
- Protected logout
- Protected current-user profile endpoint
- Password is never returned in API responses

### Announcements

- Public list of announcements
- Public announcement details
- Authenticated announcement creation
- Authenticated partial update
- Authenticated deletion
- Ownership protection: only the author can update or delete an announcement
- Author information included in announcement responses

### List Query Features

`GET /announcements` supports:

- `search` — case-insensitive substring search in `title`
- `sort=newest|oldest`
- `page` — positive page number
- 10 announcements per page

The response contains both `data` and:

```json
{
  "pagination": {
    "total": 23,
    "page": 2,
    "totalPages": 3,
    "perPage": 10
  }
}
```

## Project Structure

```text
.
├── prisma/
│   ├── migrations/                  # Prisma SQL migration history
│   ├── client.ts                    # Prisma Client initialization
│   └── schema.prisma                # User, RefreshToken, Announcement models
│
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts       # Register, login, refresh, logout, /me logic
│   │   └── announcements.controller.ts
│   │                                # Announcement CRUD, search, sort, pagination,
│   │                                # ownership checks
│   │
│   ├── middleware/
│   │   ├── authenticate.ts          # Bearer-token verification and req.user
│   │   └── validate.ts              # Zod body / params / query validation
│   │
│   ├── routes/
│   │   ├── auth.routes.ts           # /auth route definitions
│   │   └── announcements.routes.ts  # /announcements route definitions
│   │
│   ├── validators/
│   │   ├── auth.validator.ts        # Auth request validation schemas
│   │   └── announcements.validator.ts
│   │                                # Announcement and query validation schemas
│   │
│   └── openapi.ts                   # OpenAPI schemas and route documentation
│
├── tests/
│   └── final_test.ps1               # End-to-end verification script
│
├── app.ts                           # Express application, routes, Swagger, errors
├── prisma.config.ts                 # Prisma configuration
├── tsconfig.json                    # TypeScript configuration
├── package.json
├── .env.example
└── README.md
```

## Database Models

### User

Stores account information and relationships to announcements and refresh tokens.

Important fields:

- `id`
- `username` — unique
- `email` — unique
- `password` — bcrypt hash only
- `name`
- `createdAt`

### RefreshToken

Stores active refresh tokens associated with users.

Important fields:

- `token` — unique
- `userId`
- `createdAt`

### Announcement

Stores announcement data.

Important fields:

- `title`
- `description`
- `price`
- `category`
- `userId`
- `createdAt`
- `updatedAt`

`updatedAt` is maintained automatically by Prisma.

## API Endpoints

### Authentication

| Method | Endpoint | Authentication | Description |
|---|---|---:|---|
| POST | `/auth/register` | No | Register a user and return access + refresh tokens |
| POST | `/auth/login` | No | Authenticate and return a new token pair |
| POST | `/auth/refresh` | No | Rotate the refresh token and return a new token pair |
| POST | `/auth/logout` | Yes | Invalidate the current user's refresh token |
| GET | `/auth/me` | Yes | Return the authenticated user's profile |

### Announcements

| Method | Endpoint | Authentication | Description |
|---|---|---:|---|
| GET | `/announcements` | No | List announcements with pagination/search/sorting |
| GET | `/announcements/:id` | No | Get one announcement |
| POST | `/announcements` | Yes | Create an announcement |
| PATCH | `/announcements/:id` | Yes + owner | Partially update an announcement |
| DELETE | `/announcements/:id` | Yes + owner | Delete an announcement |

## Validation

### Registration

- `username`: 3–30 characters
- `email`: valid email
- `password`: at least 6 characters
- `name`: at least 2 characters

### Announcement

- `title`: 5–50 characters
- `description`: at least 10 characters
- `price`: positive number
- `category`: `sale`, `service`, `job`, or `other`

For `PATCH`, all announcement fields are optional, but an empty object is rejected.

## Authentication Flow

### Registration / Login

Successful registration and login return:

```json
{
  "user": {
    "id": 1,
    "username": "fedor",
    "email": "fedor@example.com",
    "name": "Fedor"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

Protected routes use:

```http
Authorization: Bearer <accessToken>
```

### Refresh-Token Rotation

`POST /auth/refresh` verifies both:

1. the JWT signature;
2. that the supplied refresh token still exists in the database.

After a successful refresh, the old token is deleted and a new refresh token is stored. Reusing the previous refresh token therefore returns `401`.

## Ownership Protection

The author of an announcement is always taken from:

```ts
req.user.sub
```

The client cannot assign `userId` manually.

Before `PATCH` or `DELETE`, the server compares the announcement's `userId` with the authenticated user's ID.

A non-owner receives:

```json
{
  "message": "Access denied"
}
```

with HTTP status `403`.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and provide:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/announcements
JWT_SECRET=YOUR_LONG_SECRET
```

> `.env` contains secrets and must not be committed to GitHub.

### 3. Apply database migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run the application

```bash
npm run dev
```

The API runs at:

```text
http://localhost:3000
```

Swagger UI:

```text
http://localhost:3000/api-docs
```

## OpenAPI / Swagger

All authentication and announcement routes are documented through the OpenAPI registry.

Protected endpoints use the registered `bearerAuth` security scheme and are displayed with authorization support in Swagger UI.

Open:

```text
http://localhost:3000/api-docs
```

to inspect and test the API interactively.

## Tests

The repository includes:

```text
tests/final_test.ps1
```

This is an end-to-end verification script for the completed API.

It starts the application, runs the test suite, and stops the test server automatically.

Run it from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\final_test.ps1
```

The script verifies:

- Swagger `/api-docs` opens
- registration returns `201`
- password is not returned
- access and refresh tokens are generated
- duplicate registration returns `409`
- invalid password returns `401`
- nonexistent username returns the same `Invalid credentials` response
- successful login
- protected `/auth/me`
- refresh-token rotation
- old refresh token cannot be reused
- authenticated announcement creation
- author information in responses
- public announcement list
- pagination with 10 records per page
- case-insensitive title search
- newest/oldest sorting
- announcement lookup by ID
- `404` for missing announcement
- rejection of an empty `PATCH`
- owner update
- `403` when another user attempts to update
- `403` when another user attempts to delete
- owner deletion returns `204`
- logout returns `204`
- refresh token becomes invalid after logout

Successful execution ends with:

```text
ALL FINAL TESTS PASSED
TypeScript + Auth + CRUD + Pagination + Search + Sort + Ownership + Swagger verified.
```

The project also passes the TypeScript compiler check:

```bash
npx tsc --noEmit
```

## Submission Notes

The repository should contain source code, Prisma schema and migrations, the test script, README, and project configuration files.

Do **not** submit:

- `.env`
- `node_modules/`
- local secrets or passwords

The course submission requires both:

1. a GitHub repository link;
2. uploaded project files or an archive.

## License / Academic Work

This repository is an educational project completed as part of the Neoversity coursework.

**Author: Fedor Stoietskyi**
