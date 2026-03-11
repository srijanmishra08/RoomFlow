import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

// GET /api/projects – list designer's projects
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer) {
    return NextResponse.json({ error: "Designer profile not found" }, { status: 404 });
  }

  const projects = await prisma.project.findMany({
    where: { designerId: designer.id },
    include: {
      client: { include: { user: { select: { name: true, email: true } } } },
      rooms: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

// POST /api/projects – create project
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer) {
    return NextResponse.json({ error: "Designer profile not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      designerId: designer.id,
    },
  });

  await logActivity(project.id, session.user.id, "PROJECT_CREATED", `Created project "${project.title}"`);

  return NextResponse.json(project, { status: 201 });
}
