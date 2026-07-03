import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { assertWithinPlan } from "@/lib/plans";
import { logActivity } from "@/lib/activity";

// POST /api/projects/[id]/duplicate — deep-clone a project (rooms + objects)
// as a new project owned by the same designer. Useful for templates.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const designer = await prisma.designer.findUnique({ where: { userId: session.user.id } });
  if (!designer) {
    return NextResponse.json({ error: "Designer profile not found" }, { status: 404 });
  }

  const source = await prisma.project.findUnique({
    where: { id },
    include: { rooms: { include: { objects: true } } },
  });
  if (!source || source.designerId !== designer.id) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const planBlock = await assertWithinPlan(designer.id, "create-project");
  if (planBlock) {
    return NextResponse.json({ error: planBlock.error }, { status: planBlock.status });
  }

  const json = (v: unknown) => (v == null ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

  // Clone in one transaction so a partial copy never lands.
  const clone = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        designerId: designer.id,
        clientId: source.clientId,
        title: `${source.title} (Copy)`,
        description: source.description,
        status: "ACTIVE",
      },
    });

    for (const room of source.rooms) {
      await tx.room.create({
        data: {
          projectId: project.id,
          name: room.name,
          width: room.width,
          height: room.height,
          depth: room.depth,
          level: room.level,
          floorPoints: json(room.floorPoints),
          openings: json(room.openings),
          modelUrl: room.modelUrl,
          floorMaterial: json(room.floorMaterial),
          wallMaterial: json(room.wallMaterial),
          ceilingMaterial: json(room.ceilingMaterial),
          objects: {
            create: room.objects.map((o) => ({
              name: o.name,
              modelUrl: o.modelUrl,
              positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ,
              rotationX: o.rotationX, rotationY: o.rotationY, rotationZ: o.rotationZ,
              scaleX: o.scaleX, scaleY: o.scaleY, scaleZ: o.scaleZ,
              status: o.status,
              material: o.material,
              brand: o.brand,
              supplier: o.supplier,
              cost: o.cost,
              currency: o.currency,
              color: o.color,
            })),
          },
        },
      });
    }

    return project;
  });

  await logActivity(clone.id, session.user.id, "PROJECT_CREATED", `Duplicated from "${source.title}"`);

  return NextResponse.json(clone, { status: 201 });
}
