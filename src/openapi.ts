import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent(
  "securitySchemes",
  "bearerAuth",
  {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
  },
);

const UserSchema = registry.register(
  "User",
  z.object({
    id: z.number().int(),
    username: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
);

const UserProfileSchema = registry.register(
  "UserProfile",
  UserSchema.extend({
    createdAt: z.string().datetime(),
  }),
);

const TokensSchema = registry.register(
  "Tokens",
  z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
);

const AuthResponseSchema = registry.register(
  "AuthResponse",
  z.object({
    user: UserSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
  }),
);

const AnnouncementSchema = registry.register(
  "Announcement",
  z.object({
    id: z.number().int(),
    title: z.string(),
    description: z.string(),
    price: z.number(),
    category: z.enum(["sale", "service", "job", "other"]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    user: UserSchema,
  }),
);

const PaginationSchema = registry.register(
  "Pagination",
  z.object({
    total: z.number().int(),
    page: z.number().int(),
    totalPages: z.number().int(),
    perPage: z.number().int(),
  }),
);

const AnnouncementListSchema = registry.register(
  "AnnouncementList",
  z.object({
    data: z.array(AnnouncementSchema),
    pagination: PaginationSchema,
  }),
);

const ErrorSchema = registry.register(
  "ErrorResponse",
  z.object({
    message: z.string(),
  }),
);

const ValidationErrorSchema = registry.register(
  "ValidationError",
  z.object({
    message: z.string(),
    errors: z.array(
      z.object({
        message: z.string(),
      }),
    ),
  }),
);

const RegisterRequestSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

const AnnouncementIdParamsSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
});

const AnnouncementQuerySchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["newest", "oldest"]).optional(),
  page: z.string().regex(/^[1-9]\d*$/).optional(),
});

const CreateAnnouncementRequestSchema = z.object({
  title: z.string().min(5).max(50),
  description: z.string().min(10),
  price: z.number().positive(),
  category: z.enum(["sale", "service", "job", "other"]),
});

const UpdateAnnouncementRequestSchema =
  CreateAnnouncementRequestSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    {
      message: "At least one field must be provided",
    },
  );

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Register a new user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "User registered",
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    409: {
      description: "Username or email already taken",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
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
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: AuthResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Rotate refresh token and issue a new token pair",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RefreshRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "New token pair",
      content: {
        "application/json": {
          schema: TokensSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    401: {
      description: "Invalid refresh token",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Logout",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    204: {
      description: "Logged out",
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  summary: "Get current user profile",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: "Current user",
      content: {
        "application/json": {
          schema: UserProfileSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements",
  summary: "List announcements",
  request: {
    query: AnnouncementQuerySchema,
  },
  responses: {
    200: {
      description: "Announcement list",
      content: {
        "application/json": {
          schema: AnnouncementListSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements/{id}",
  summary: "Get announcement by ID",
  request: {
    params: AnnouncementIdParamsSchema,
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
    400: {
      description: "Invalid ID",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    404: {
      description: "Announcement not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/announcements",
  summary: "Create announcement",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateAnnouncementRequestSchema,
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
      description: "Validation error",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/announcements/{id}",
  summary: "Update own announcement",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: AnnouncementIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateAnnouncementRequestSchema,
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
      description: "Validation error",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Access denied",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Announcement not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/announcements/{id}",
  summary: "Delete own announcement",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: AnnouncementIdParamsSchema,
  },
  responses: {
    204: {
      description: "Announcement deleted",
    },
    400: {
      description: "Invalid ID",
      content: {
        "application/json": {
          schema: ValidationErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    403: {
      description: "Access denied",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: "Announcement not found",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "Announcements REST API",
      version: "1.0.0",
      description:
        "REST API for an announcements board with JWT authentication, refresh-token rotation and ownership checks.",
    },
    servers: [{ url: "http://localhost:3000" }],
  });
}
