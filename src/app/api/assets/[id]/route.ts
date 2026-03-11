import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/assets/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer) {
    return NextResponse.json({ error: "Designer not found" }, { status: 404 });
  }

  const asset = await prisma.asset.findUnique({ where: { id } });

  if (!asset || asset.designerId !== designer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.asset.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
