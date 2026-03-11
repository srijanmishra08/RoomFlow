import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateObjectSchema } from "@/lib/validations";

// PATCH /api/objects/[objectId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ objectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectId } = await params;
  const body = await req.json();
  const parsed = updateObjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const obj = await prisma.roomObject.update({
    where: { id: objectId },
    data: parsed.data,
  });

  return NextResponse.json(obj);
}

// DELETE /api/objects/[objectId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ objectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectId } = await params;

  await prisma.roomObject.delete({ where: { id: objectId } });

  return NextResponse.json({ message: "Object deleted" });
}
