import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const UserSchema = registry.register(
  "User",
  z.object({
    id: z.number().int(),
    username: z.string(),
    email: z.string().email(),
    name: z.string(),
    createdAt: z.string().datetime(),
  }),
);

const AnnouncementSchema = registry.register(
  "Announcement",
  z.object({
    id: z.number().int(),
    title: z.string(),
    description: z.string(),
    price: z.number(),
    category: z.string(),
    imageUrl: z.string().url().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    user: UserSchema,
  }),
);

const RegisterSchema = z.object({
  username: z.string(),
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

const IdParamsSchema = z.object({
  id: z.string().openapi({
    param: {
      name: "id",
      in: "path",
    },
    example: "1",
  }),
});

const ListQuerySchema = z.object({
  page: z.string().optional().openapi({
    param: {
      name: "page",
      in: "query",
    },
    example: "1",
  }),
  search: z.string().optional().openapi({
    param: {
      name: "search",
      in: "query",
    },
  }),
  sort: z.enum(["newest", "oldest"]).optional().openapi({
    param: {
      name: "sort",
      in: "query",
    },
  }),
});

const CreateAnnouncementMultipartSchema = z.object({
  title: z.string(),
  description: z.string(),
  price: z.coerce.number().positive(),
  category: z.string(),
  image: z.any().optional().openapi({
    type: "string",
    format: "binary",
    description: "Optional announcement photo",
  }),
});

const UpdateAnnouncementMultipartSchema =
  CreateAnnouncementMultipartSchema.partial();

const bearerSecurity = [{ bearerAuth: [] }];

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Register user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "User registered",
    },
    409: {
      description: "Username or email already taken",
    },
    429: {
      description: "Too many requests",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Login",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Logged in",
    },
    401: {
      description: "Invalid credentials",
    },
    429: {
      description: "Too many requests",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Rotate refresh token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RefreshSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "New token pair",
    },
    401: {
      description: "Invalid refresh token",
    },
    429: {
      description: "Too many requests",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Logout",
  security: bearerSecurity,
  responses: {
    204: {
      description: "Logged out",
    },
    401: {
      description: "Unauthorized",
    },
    429: {
      description: "Too many requests",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  summary: "Current user",
  security: bearerSecurity,
  responses: {
    200: {
      description: "Current user",
      content: {
        "application/json": {
          schema: UserSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
    },
    429: {
      description: "Too many requests",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements",
  summary: "List announcements",
  request: {
    query: ListQuerySchema,
  },
  responses: {
    200: {
      description: "Announcement list",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements/{id}",
  summary: "Get announcement",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "Announcement",
      content: {
        "application/json": {
          schema: AnnouncementSchema,
        },
      },
    },
    404: {
      description: "Announcement not found",
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/announcements",
  summary: "Create announcement",
  security: bearerSecurity,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: CreateAnnouncementMultipartSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Announcement created",
      content: {
        "application/json": {
          schema: AnnouncementSchema,
        },
      },
    },
    400: {
      description: "Validation failed",
    },
    401: {
      description: "Unauthorized",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/announcements/{id}",
  summary: "Update announcement",
  security: bearerSecurity,
  request: {
    params: IdParamsSchema,
    body: {
      content: {
        "multipart/form-data": {
          schema: UpdateAnnouncementMultipartSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Announcement updated",
      content: {
        "application/json": {
          schema: AnnouncementSchema,
        },
      },
    },
    400: {
      description: "No update data",
    },
    401: {
      description: "Unauthorized",
    },
    403: {
      description: "Access denied",
    },
    404: {
      description: "Announcement not found",
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/announcements/{id}",
  summary: "Delete announcement",
  security: bearerSecurity,
  request: {
    params: IdParamsSchema,
  },
  responses: {
    204: {
      description: "Announcement deleted",
    },
    401: {
      description: "Unauthorized",
    },
    403: {
      description: "Access denied",
    },
    404: {
      description: "Announcement not found",
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "Announcements REST API",
    version: "1.0.0",
    description:
      "JWT-authenticated announcements API with production security, logging and Cloudinary photo uploads.",
  },
});