import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDesigner } from "@/lib/authz";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ASSISTANT", "VIEWER"]),
});

// GET /api/settings/team – list this studio's team members
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const designer = await getDesigner(session.user.id);
  if (!designer) {
    return NextResponse.json({ error: "No designer profile" }, { status: 403 });
  }
  const members = await prisma.teamMember.findMany({
    where: { designerId: designer.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(members);
}

// POST /api/settings/team – add a member by email (user must already exist)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const designer = await getDesigner(session.user.id);
  if (!designer) {
    return NextResponse.json({ error: "No designer profile" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!target) {
    return NextResponse.json(
      { error: "No RoomFlow account with that email. Ask them to register first." },
      { status: 404 }
    );
  }
  if (target.id === session.user.id) {
    return NextResponse.json({ error: "You already own this studio." }, { status: 400 });
  }
  const member = await prisma.teamMember.upsert({
    where: { designerId_userId: { designerId: designer.id, userId: target.id } },
    create: { designerId: designer.id, userId: target.id, role: parsed.data.role },
    update: { role: parsed.data.role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(member, { status: 201 });
}

// DELETE /api/settings/team?memberId=... – remove a member
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const designer = await getDesigner(session.user.id);
  if (!designer) {
    return NextResponse.json({ error: "No designer profile" }, { status: 403 });
  }
  const memberId = req.nextUrl.searchParams.get("memberId");
  if (!memberId) {
    return NextResponse.json({ error: "memberId required" }, { status: 400 });
  }
  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member || member.designerId !== designer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
