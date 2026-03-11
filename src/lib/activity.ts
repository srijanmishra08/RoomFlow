import { prisma } from "./prisma";
import type { ActivityType } from "@prisma/client";

export async function logActivity(
  projectId: string,
  userId: string,
  type: ActivityType,
  message: string,
  metadata?: Record<string, unknown>
) {
  try {
    await prisma.activity.create({
      data: {
        projectId,
        userId,
        type,
        message,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
  } catch {
    // Activity logging should never break the main flow
    console.error("Failed to log activity:", type, message);
  }
}
