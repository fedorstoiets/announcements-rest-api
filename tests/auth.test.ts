import { beforeAll, describe, expect, it } from "vitest";
import jwt, { type JwtPayload } from "jsonwebtoken";
import {
  generateTokenPair,
  hashPassword,
  verifyPassword,
} from "../src/utils/auth.ts";

beforeAll(() => {
  process.env.JWT_SECRET = "vitest-only-secret";
});

describe("auth utilities", () => {
  it("hashes passwords instead of storing plain text", async () => {
    const password = "StrongPassword123!";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies a valid password and rejects an invalid one", async () => {
    const hash = await hashPassword("correct-password");

    await expect(verifyPassword("correct-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("generates a 15-minute access token and 7-day refresh token", () => {
    const { accessToken, refreshToken } = generateTokenPair(42);

    const access = jwt.decode(accessToken) as JwtPayload;
    const refresh = jwt.decode(refreshToken) as JwtPayload;

    expect(access.sub).toBe("42");
    expect(access.type).toBe("access");
    expect((access.exp ?? 0) - (access.iat ?? 0)).toBe(15 * 60);

    expect(refresh.sub).toBe("42");
    expect(refresh.type).toBe("refresh");
    expect((refresh.exp ?? 0) - (refresh.iat ?? 0)).toBe(7 * 24 * 60 * 60);
    expect(refresh.jti).toBeTruthy();
  });
});