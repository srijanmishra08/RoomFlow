import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validations";

// GET /api/objects/[objectId]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ objectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectId } = await params;

  const comments = await prisma.comment.findMany({
    where: { objectId },
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

// POST /api/objects/[objectId]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ objectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectId } = await params;
  const body = await req.json();
  const parsed = createCommentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      content: parsed.data.content,
      objectId,
      userId: session.user.id,
    },
    include: {
      user: { select: { name: true, email: true, role: true } },
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
