import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/client-portal/[projectId] – public client portal (no auth required, just project ID)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      designer: {
        include: { user: { select: { name: true } } },
      },
      rooms: {
        include: {
          objects: {
            include: {
              comments: {
                include: { user: { select: { name: true, role: true } } },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Strip sensitive data – only return what the client needs
  return NextResponse.json({
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    designerName: project.designer.user.name || project.designer.studioName,
    rooms: project.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      width: room.width,
      height: room.height,
      depth: room.depth,
      objects: room.objects.map((obj) => ({
        id: obj.id,
        name: obj.name,
        modelUrl: obj.modelUrl,
        positionX: obj.positionX,
        positionY: obj.positionY,
        positionZ: obj.positionZ,
        rotationX: obj.rotationX,
        rotationY: obj.rotationY,
        rotationZ: obj.rotationZ,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        scaleZ: obj.scaleZ,
        status: obj.status,
        material: obj.material,
        brand: obj.brand,
        cost: obj.cost,
        currency: obj.currency,
        deliveryDate: obj.deliveryDate,
        comments: obj.comments,
      })),
    })),
  });
}
