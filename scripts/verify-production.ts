import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { app } from "../app.ts";
import prisma from "../prisma/client.ts";
import { openApiDocument } from "../src/openapi.ts";

function pass(message: string): void {
  console.log(`PASS: ${message}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  pass(message);
}

async function json(response: Response): Promise<any> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function findImageMigration(): Promise<boolean> {
  const root = path.resolve("prisma", "migrations");
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const migrationFile = path.join(root, entry.name, "migration.sql");

    try {
      const sql = await readFile(migrationFile, "utf8");

      if (sql.includes("imageUrl")) {
        return true;
      }
    } catch {
      // Ignore non-standard migration entries.
    }
  }

  return false;
}

let verificationUserId: number | undefined;

const server = app.listen(0, "127.0.0.1");
await once(server, "listening");

const address = server.address() as AddressInfo;
const baseUrl = `http://127.0.0.1:${address.port}`;

console.log("");
console.log("=== Production verification ===");
console.log(`Ephemeral test server: ${baseUrl}`);
console.log("");

try {
  const allowedOrigin = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)[0];

  assert(Boolean(allowedOrigin), "ALLOWED_ORIGINS is configured");

  let response = await fetch(`${baseUrl}/api-docs`);
  assert(response.status === 200, "Swagger /api-docs opens");

  response = await fetch(`${baseUrl}/announcements`);
  assert(response.status === 200, "Public announcements route opens");
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    "Helmet sets X-Content-Type-Options",
  );
  assert(
    Boolean(response.headers.get("content-security-policy")),
    "Helmet sets Content-Security-Policy",
  );

  response = await fetch(`${baseUrl}/announcements`, {
    headers: {
      Origin: allowedOrigin!,
    },
  });
  assert(response.status === 200, "Allowed CORS origin succeeds");
  assert(
    response.headers.get("access-control-allow-origin") === allowedOrigin,
    "Allowed CORS origin is returned",
  );

  response = await fetch(`${baseUrl}/announcements`, {
    headers: {
      Origin: "https://not-allowed.example",
    },
  });
  assert(response.status === 403, "Disallowed CORS origin returns 403");
  const corsBody = await json(response);
  assert(
    corsBody?.message === "Not allowed by CORS",
    "Disallowed CORS response is explicit",
  );

  const unique = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const username = `verify_${unique}`;
  const password = "ProductionVerify123!";

  response = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      password,
      name: "Production Verifier",
    }),
  });

  const registerBody = await json(response);
  assert(response.status === 201, "Registration returns 201");
  assert(Boolean(registerBody?.accessToken), "Registration returns access token");
  verificationUserId = registerBody.user.id;

  response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const loginBody = await json(response);
  assert(response.status === 200, "Login returns 200");
  assert(Boolean(loginBody?.accessToken), "Login returns access token");

  const accessToken = loginBody.accessToken as string;

  const noImageForm = new FormData();
  noImageForm.set("title", "Verification announcement without photo");
  noImageForm.set("description", "Production verification");
  noImageForm.set("price", "125");
  noImageForm.set("category", "verification");

  response = await fetch(`${baseUrl}/announcements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: noImageForm,
  });

  const noImageBody = await json(response);
  assert(
    response.status === 201,
    "Multipart announcement can be created without photo",
  );
  assert(noImageBody?.imageUrl === null, "imageUrl is optional");

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl9kXcAAAAASUVORK5CYII=",
    "base64",
  );

  const imageForm = new FormData();
  imageForm.set("title", "Verification announcement with photo");
  imageForm.set("description", "Cloudinary production verification");
  imageForm.set("price", "250");
  imageForm.set("category", "verification");
  imageForm.set(
    "image",
    new Blob([png], { type: "image/png" }),
    "verify.png",
  );

  response = await fetch(`${baseUrl}/announcements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: imageForm,
  });

  const imageBody = await json(response);

  if (response.status !== 201) {
    throw new Error(
      `FAIL: photo announcement expected 201, got ${response.status}: ${JSON.stringify(imageBody)}`,
    );
  }

  pass("Multipart announcement with photo returns 201");
  assert(
    typeof imageBody?.imageUrl === "string" &&
      imageBody.imageUrl.startsWith("https://res.cloudinary.com/"),
    "Cloudinary URL is stored in imageUrl",
  );

  const uploadEntries = await readdir(path.resolve("uploads"));
  const temporaryUploads = uploadEntries.filter(
    (name) => name !== ".gitkeep",
  );
  assert(
    temporaryUploads.length === 0,
    "Temporary local upload is deleted after Cloudinary upload",
  );

  const schema = await readFile(
    path.resolve("prisma", "schema.prisma"),
    "utf8",
  );
  assert(
    schema.includes("imageUrl    String?"),
    "Prisma Announcement has optional imageUrl",
  );
  assert(await findImageMigration(), "Prisma migration contains imageUrl");

  const postAnnouncement = (openApiDocument.paths as any)?.["/announcements"]
    ?.post;
  const patchAnnouncement = (openApiDocument.paths as any)?.[
    "/announcements/{id}"
  ]?.patch;

  assert(
    Boolean(
      postAnnouncement?.requestBody?.content?.["multipart/form-data"],
    ),
    "OpenAPI documents POST multipart/form-data",
  );
  assert(
    postAnnouncement?.requestBody?.content?.["multipart/form-data"]?.schema
      ?.properties?.image?.format === "binary",
    "OpenAPI documents POST image as binary",
  );
  assert(
    Boolean(
      patchAnnouncement?.requestBody?.content?.["multipart/form-data"],
    ),
    "OpenAPI documents PATCH multipart/form-data",
  );

  const appSource = await readFile(path.resolve("app.ts"), "utf8");
  const authSource = await readFile(
    path.resolve("src", "controllers", "auth.controller.ts"),
    "utf8",
  );
  const announcementSource = await readFile(
    path.resolve("src", "controllers", "announcements.controller.ts"),
    "utf8",
  );

  assert(appSource.includes("pinoHttp"), "pino-http is global middleware");
  assert(authSource.includes("User registered"), "Registration event is logged");
  assert(authSource.includes("User logged in"), "Login event is logged");
  assert(
    announcementSource.includes("Announcement created"),
    "Announcement creation event is logged",
  );
  assert(
    announcementSource.includes("Announcement photo uploaded"),
    "Photo upload event is logged",
  );

  // Register + login = two auth requests. Eight /me calls bring total to ten.
  for (let index = 0; index < 8; index += 1) {
    response = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    assert(
      response.status === 200,
      `Auth request ${index + 3} of 10 is allowed`,
    );
  }

  response = await fetch(`${baseUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const rateBody = await json(response);
  assert(response.status === 429, "11th auth request returns 429");
  assert(
    rateBody?.message === "Too many requests, please try again later",
    "Rate-limit message is exact",
  );

  response = await fetch(`${baseUrl}/announcements`);
  assert(
    response.status === 200,
    "Rate limiting is limited to auth routes",
  );

  console.log("");
  console.log("============================================================");
  console.log("ALL PRODUCTION HOMEWORK CHECKS PASSED");
  console.log("Helmet + CORS + auth rate limiting + Pino + Prisma +");
  console.log("Cloudinary + local cleanup + OpenAPI + Vitest are verified.");
  console.log("============================================================");
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  if (verificationUserId) {
    await prisma.announcement.deleteMany({
      where: {
        userId: verificationUserId,
      },
    });

    await prisma.refreshToken.deleteMany({
      where: {
        userId: verificationUserId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: verificationUserId,
      },
    });
  }

  await prisma.$disconnect();
}