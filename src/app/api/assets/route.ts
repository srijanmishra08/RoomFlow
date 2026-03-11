import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAssetSchema } from "@/lib/validations";

// GET /api/assets
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

  const assets = await prisma.asset.findMany({
    where: { designerId: designer.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assets);
}

// POST /api/assets
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
  const parsed = createAssetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const asset = await prisma.asset.create({
    data: {
      ...parsed.data,
      designerId: designer.id,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
