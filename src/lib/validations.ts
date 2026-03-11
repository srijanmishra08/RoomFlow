import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  studioName: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── Projects ─────────────────────────────────────────────────

export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  clientId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  clientId: z.string().nullable().optional(),
});

// ─── Rooms ────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required"),
  width: z.number().positive().default(5),
  height: z.number().positive().default(3),
  depth: z.number().positive().default(5),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  depth: z.number().positive().optional(),
});

// ─── Objects ──────────────────────────────────────────────────

export const createObjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  modelUrl: z.string().url().optional().nullable(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  positionZ: z.number().default(0),
  rotationX: z.number().default(0),
  rotationY: z.number().default(0),
  rotationZ: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  scaleZ: z.number().default(1),
  status: z.enum(["PLANNED", "IN_PROGRESS", "FINALIZED"]).default("PLANNED"),
  material: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  currency: z.string().default("INR"),
  deliveryDate: z.string().datetime().optional().nullable(),
  color: z.string().optional().nullable(),
});

export const updateObjectSchema = createObjectSchema.partial();

// ─── Clients ──────────────────────────────────────────────────

export const createClientSchema = z.object({
  name: z.string().min(1, "Client name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// ─── Comments ─────────────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
});

// ─── Assets ───────────────────────────────────────────────────

export const createAssetSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  fileUrl: z.string().url("Invalid file URL"),
  fileType: z.string().default("glb"),
  thumbnail: z.string().url().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
});

// ─── Profile / Settings ───────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  studioName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  bio: z.string().max(500, "Bio must be under 500 characters").optional().nullable(),
});

// ─── Approvals ────────────────────────────────────────────────

export const createApprovalSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
  note: z.string().optional().nullable(),
});

// ─── Notifications ────────────────────────────────────────────

export const markNotificationReadSchema = z.object({
  notificationIds: z.array(z.string()).min(1),
});

// Type exports
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateObjectInput = z.infer<typeof createObjectSchema>;
export type UpdateObjectInput = z.infer<typeof updateObjectSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateApprovalInput = z.infer<typeof createApprovalSchema>;
