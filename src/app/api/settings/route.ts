import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations";

// GET /api/settings – get designer profile
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      designer: {
        select: {
          studioName: true,
          phone: true,
          bio: true,
        },
      },
      subscription: {
        select: {
          plan: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// PATCH /api/settings – update designer profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, studioName, phone, bio } = parsed.data;

  // Update user name if provided
  if (name) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name },
    });
  }

  // Update designer profile
  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (designer) {
    await prisma.designer.update({
      where: { id: designer.id },
      data: {
        ...(studioName !== undefined && { studioName }),
        ...(phone !== undefined && { phone }),
        ...(bio !== undefined && { bio }),
      },
    });
  }

  return NextResponse.json({ success: true });
}
