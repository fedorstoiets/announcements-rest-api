# Announcements REST API

Production-ready REST API for an announcements board, built with **Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, OpenAPI, Pino, Multer, and Cloudinary**.

**Author:** Fedor Stoietskyi

---

## Overview

The application allows users to register, authenticate, and manage their own announcements through a JSON REST API.

Anonymous users can:

- browse announcements;
- search announcements by title;
- sort announcements by creation date;
- view a single announcement.

Authenticated users can additionally:

- create announcements;
- upload an optional announcement image;
- update their own announcements;
- replace/add an image while updating;
- delete their own announcements;
- refresh JWT credentials;
- log out;
- retrieve their profile.

The project also includes production-oriented security, request logging, API documentation, image storage, database migrations, and automated tests.

---

## Production Upgrade

The original REST API was extended with the following production features.

### Security

- **Helmet** is enabled globally to add secure HTTP headers.
- **CORS** accepts browser requests only from origins listed in `ALLOWED_ORIGINS`.
- **Rate limiting** is applied to all `/auth` routes.
- Maximum authentication traffic: **10 requests per IP per 15 minutes**.
- Rate-limit response:

```json
{
  "message": "Too many requests, please try again later"
}
```

### Logging

The project uses:

- `pino`
- `pino-http`

Every HTTP request is logged automatically.

Important application events are also logged, including:

- new user registration;
- successful login;
- announcement creation;
- announcement photo upload.

### Announcement Images

`POST /announcements` and `PATCH /announcements/:id` support:

```text
multipart/form-data
```

The optional image field is:

```text
image
```

Upload flow:

1. Multer temporarily stores the image in `uploads/`.
2. The image is uploaded to Cloudinary.
3. The temporary local file is deleted.
4. Only the Cloudinary URL is saved to PostgreSQL as `imageUrl`.

Announcements can still be created without an image.

### Testing

The project uses **Vitest**.

Included automated tests verify:

- password hashing;
- correct password verification and rejection of invalid passwords;
- JWT access/refresh token lifetimes.

A production verification script also checks the complete application flow, including Helmet, CORS, authentication, rate limiting, Prisma, Cloudinary, OpenAPI, and temporary-file cleanup.

---

## Tech Stack

| Area | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Web framework | Express |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| PostgreSQL adapter | `@prisma/adapter-pg` |
| Validation | Zod |
| Authentication | JWT |
| Password hashing | bcrypt |
| Security headers | Helmet |
| CORS | cors |
| Rate limiting | express-rate-limit |
| Logging | Pino + pino-http |
| File upload | Multer |
| Image hosting | Cloudinary |
| API documentation | OpenAPI / Swagger UI |
| Testing | Vitest |

---

## Project Structure

```text
.
├── prisma/
│   ├── migrations/
│   ├── client.ts
│   └── schema.prisma
│
├── scripts/
│   └── verify-production.ts
│
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── announcements.controller.ts
│   │
│   ├── middleware/
│   │   ├── authenticate.ts
│   │   ├── upload.ts
│   │   └── validate.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── announcements.routes.ts
│   │
│   ├── utils/
│   │   └── auth.ts
│   │
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   └── announcements.validator.ts
│   │
│   ├── logger.ts
│   └── openapi.ts
│
├── tests/
│   └── auth.test.ts
│
├── uploads/
│   └── .gitkeep
│
├── app.ts
├── prisma.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

---

## Environment Variables

Create a local `.env` file in the project root.

Use `.env.example` as the template:

```env
DATABASE_URL=
JWT_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Important

`.env` contains private credentials and **must never be committed to GitHub**.

The repository contains only `.env.example`, with variable names and safe example values.

---

## Installation

Install dependencies:

```bash
npm install
```

Generate the Prisma client:

```bash
npx prisma generate
```

Check migration status:

```bash
npx prisma migrate status
```

If starting with an empty database, apply migrations:

```bash
npx prisma migrate deploy
```

---

## Running the API

Development mode:

```bash
npm run dev
```

Normal start:

```bash
npm start
```

By default, the API runs on:

```text
http://localhost:3000
```

Swagger UI:

```text
http://localhost:3000/api-docs
```

---

## Available NPM Scripts

```bash
npm run dev
```

Starts the application using `tsx watch`.

```bash
npm start
```

Starts the application normally.

```bash
npm run typecheck
```

Runs the TypeScript compiler without emitting files.

```bash
npm test
```

Runs Vitest in watch mode.

```bash
npm run test:run
```

Runs the complete Vitest suite once.

```bash
npm run verify:production
```

Runs the integrated production verification suite.

```bash
npm run prisma:generate
```

Regenerates the Prisma client.

---

# API Reference

## Authentication

### Register

```http
POST /auth/register
```

JSON body:

```json
{
  "username": "john_smith",
  "email": "john@example.com",
  "password": "StrongPassword123!",
  "name": "John Smith"
}
```

Successful response:

```text
201 Created
```

The password is stored only as a bcrypt hash and is never returned in an API response.

---

### Login

```http
POST /auth/login
```

JSON body:

```json
{
  "username": "john_smith",
  "password": "StrongPassword123!"
}
```

Successful authentication returns:

- user data;
- access token;
- refresh token.

Invalid username and invalid password intentionally return the same response:

```text
401 Invalid credentials
```

---

### Refresh Tokens

```http
POST /auth/refresh
```

The API verifies the refresh token and performs **token rotation**:

1. verifies the JWT signature;
2. verifies that the refresh token exists in the database;
3. removes the old refresh token;
4. creates and stores a new refresh token;
5. returns a new access/refresh pair.

---

### Logout

```http
POST /auth/logout
```

Requires:

```http
Authorization: Bearer <access-token>
```

Successful response:

```text
204 No Content
```

---

### Current User

```http
GET /auth/me
```

Requires:

```http
Authorization: Bearer <access-token>
```

Returns the current authenticated user without the password field.

---

## Announcements

### List Announcements

```http
GET /announcements
```

Optional query parameters:

| Parameter | Description |
|---|---|
| `page` | Page number |
| `search` | Case-insensitive search in the title |
| `sort` | `newest` or `oldest` |

Pagination uses **10 announcements per page**.

Example:

```http
GET /announcements?page=2&search=laptop&sort=newest
```

Response structure:

```json
{
  "data": [],
  "pagination": {
    "total": 0,
    "page": 2,
    "totalPages": 0,
    "perPage": 10
  }
}
```

---

### Get One Announcement

```http
GET /announcements/:id
```

Public route.

Returns:

- announcement data;
- optional `imageUrl`;
- author information.

---

### Create Announcement

```http
POST /announcements
```

Protected route.

Requires:

```http
Authorization: Bearer <access-token>
```

Content type:

```text
multipart/form-data
```

Fields:

| Field | Required | Type |
|---|---:|---|
| `title` | Yes | text |
| `description` | Yes | text |
| `price` | Yes | number |
| `category` | Yes | text |
| `image` | No | image file |

The announcement author is always derived from the authenticated JWT. A client cannot manually select another `userId`.

---

### Update Announcement

```http
PATCH /announcements/:id
```

Protected route.

Supports partial updates through:

```text
multipart/form-data
```

Any announcement field may be updated, and a new optional image may be uploaded.

Only the announcement owner can update it.

Attempting to update another user's announcement returns:

```text
403 Access denied
```

---

### Delete Announcement

```http
DELETE /announcements/:id
```

Protected route.

Only the announcement owner can delete it.

Successful response:

```text
204 No Content
```

---

## Authentication Tokens

The API uses two JWT types:

| Token | Lifetime |
|---|---:|
| Access token | 15 minutes |
| Refresh token | 7 days |

The access token is sent in the request header:

```http
Authorization: Bearer <access-token>
```

Refresh tokens are stored in PostgreSQL and rotated when refreshed.

---

## Database Models

### User

Stores:

- username;
- email;
- bcrypt password hash;
- name;
- registration date.

### RefreshToken

Stores:

- refresh token;
- associated user;
- creation date.

### Announcement

Stores:

- title;
- description;
- price;
- category;
- optional `imageUrl`;
- author;
- `createdAt`;
- automatically updated `updatedAt`.

---

## Security Behavior

### Helmet

Helmet is enabled globally and adds security-related HTTP response headers.

### CORS

Allowed origins are configured through:

```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Requests from browser origins outside this list receive:

```text
403
```

### Authentication Rate Limit

All routes under `/auth` are limited to:

```text
10 requests / 15 minutes / IP
```

After the limit is reached:

```json
{
  "message": "Too many requests, please try again later"
}
```

The public announcements routes remain available because the rate limiter is scoped only to `/auth`.

---

## Logging

Pino is used as the shared application logger.

`pino-http` automatically records HTTP requests.

The controllers explicitly log important application events:

```text
User registered
User logged in
Announcement created
Announcement photo uploaded
```

---

## Image Upload Flow

```text
Client
  │
  ▼
Multer
  │
  ▼
uploads/ temporary file
  │
  ▼
Cloudinary
  │
  ├──► secure image URL → PostgreSQL imageUrl
  │
  └──► local temporary file deleted
```

The database does not store the binary image itself.

---

## OpenAPI / Swagger

Interactive API documentation is available at:

```text
/api-docs
```

The OpenAPI specification documents:

- all authentication routes;
- all announcement routes;
- Bearer authentication;
- protected endpoints;
- `multipart/form-data`;
- binary image uploads;
- optional `imageUrl`.

---

## Tests

Run:

```bash
npm run test:run
```

The included Vitest suite contains tests for:

1. bcrypt password hashing;
2. correct and incorrect password verification;
3. access and refresh JWT lifetime/claims.

---

## Full Production Verification

Run:

```bash
npm run verify:production
```

The verifier starts the Express application on a temporary local port and validates the production requirements, including:

- Swagger;
- Helmet;
- allowed CORS origin;
- rejected CORS origin;
- registration;
- login;
- announcement creation without an image;
- real Cloudinary upload;
- persistence of `imageUrl`;
- deletion of the temporary local image;
- Prisma schema and migration;
- OpenAPI multipart documentation;
- Pino logging configuration;
- exact authentication rate limiting;
- public announcement availability after the auth rate limit is reached.

Successful completion ends with:

```text
ALL PRODUCTION HOMEWORK CHECKS PASSED
```

---

## Verification Status

The rebuilt project has been verified locally with:

- valid Prisma schema;
- Prisma Client 7.7.0 generation;
- PostgreSQL migration status up to date;
- successful TypeScript compilation;
- all Vitest tests passing;
- successful live Cloudinary image upload;
- successful integrated production verification.

---

## Git / Submission Notes

Before submission:

```bash
git status
```

Confirm that `.env` is **not** staged.

Recommended files to commit include:

```text
app.ts
src/
prisma/
scripts/
tests/
uploads/.gitkeep
README.md
.env.example
.gitignore
package.json
package-lock.json
tsconfig.json
vitest.config.ts
prisma.config.ts
```

Do not commit:

```text
.env
node_modules/
generated/
temporary upload files
local repair/rebuild scripts
```

---

## Author

**Fedor Stoietskyi**
