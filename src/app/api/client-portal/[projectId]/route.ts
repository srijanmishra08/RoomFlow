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
            take: 100,
            orderBy: { createdAt: "desc" },
            include: {
              comments: {
                take: 20,
                orderBy: { createdAt: "desc" },
                include: { user: { select: { name: true, role: true } } },
              },
            },
          },
          revisions: {
            where: { status: "READY" },
            orderBy: { version: "asc" },
          },
          views: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      quotations: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 1,
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
      floorPoints: room.floorPoints,
      modelUrl: room.modelUrl,
      floorMaterial: room.floorMaterial,
      wallMaterial: room.wallMaterial,
      ceilingMaterial: room.ceilingMaterial,
      revisions: room.revisions.map((rev) => ({
        id: rev.id,
        version: rev.version,
        label: rev.label,
        type: rev.type,
        status: rev.status,
        sceneUrl: rev.sceneUrl,
        thumbnail: rev.thumbnail,
        createdAt: rev.createdAt,
      })),
      views: room.views.map((view) => ({
        id: view.id,
        name: view.name,
        revisionId: view.revisionId,
        cameraPosition: view.cameraPosition,
        cameraRotation: view.cameraRotation,
        target: view.target,
      })),
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
    quote: project.quotations[0]
      ? {
          id: project.quotations[0].id,
          status: project.quotations[0].status,
          currency: project.quotations[0].currency,
          subtotal: project.quotations[0].subtotal,
          total: project.quotations[0].total,
          items: project.quotations[0].items,
          notes: project.quotations[0].notes,
        }
      : null,
  });
}
