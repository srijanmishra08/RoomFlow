// Per-resource ownership checks. Routes must verify the logged-in user may
// touch the project chain (project → room → object), not merely that someone
// is logged in. Prevents IDOR (editing/deleting other tenants' resources).
//
// Team roles: a studio (Designer) can grant other users access via TeamMember.
// ASSISTANT may read + write; VIEWER may read only. The Designer row itself is
// the implicit owner. Checks default to `write` (most restrictive); read-only
// routes pass { write: false } to also admit viewers.

import { prisma } from "@/lib/prisma";

export interface AccessOptions {
  /** Require write access (owner or assistant). Default true. */
  write?: boolean;
}

/** Resolve the Designer profile for a user, or null. */
export async function getDesigner(userId: string) {
  return prisma.designer.findUnique({ where: { userId } });
}

/**
 * Designer ids this user can act for: their own studio plus studios that
 * granted them a team role (ASSISTANT always; VIEWER only when !write).
 */
export async function accessibleDesignerIds(
  userId: string,
  { write = true }: AccessOptions = {}
): Promise<string[]> {
  const [own, memberships] = await Promise.all([
    prisma.designer.findUnique({ where: { userId }, select: { id: true } }),
    prisma.teamMember.findMany({
      where: { userId, ...(write ? { role: "ASSISTANT" } : {}) },
      select: { designerId: true },
    }),
  ]);
  const ids = memberships.map((m) => m.designerId);
  if (own) ids.unshift(own.id);
  return ids;
}

/** Returns the project if this user may access it, else null. */
export async function assertProjectOwner(
  projectId: string,
  userId: string,
  opts: AccessOptions = {}
) {
  const ids = await accessibleDesignerIds(userId, opts);
  if (ids.length === 0) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !ids.includes(project.designerId)) return null;
  return project;
}

/** Returns the room (with project) if this user may access it, else null. */
export async function assertRoomOwner(
  roomId: string,
  userId: string,
  opts: AccessOptions = {}
) {
  const ids = await accessibleDesignerIds(userId, opts);
  if (ids.length === 0) return null;
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { project: true },
  });
  if (!room || !ids.includes(room.project.designerId)) return null;
  return room;
}

/** Returns the object (with room→project) if this user may access it, else null. */
export async function assertObjectOwner(
  objectId: string,
  userId: string,
  opts: AccessOptions = {}
) {
  const ids = await accessibleDesignerIds(userId, opts);
  if (ids.length === 0) return null;
  const obj = await prisma.roomObject.findUnique({
    where: { id: objectId },
    include: { room: { include: { project: true } } },
  });
  if (!obj || !ids.includes(obj.room.project.designerId)) return null;
  return obj;
}
