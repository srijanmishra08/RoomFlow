import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const quote = await prisma.quotation.findFirst({
    where: { projectId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json(quote);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;
  const body = await req.json();
  const action = body?.action as string | undefined;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { client: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (session?.user?.id && project.client?.userId && session.user.id !== project.client.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await prisma.quotation.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 });
  }

  const updated = await prisma.quotation.update({
    where: { id: quote.id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      approvedAt: action === "approve" ? new Date() : null,
    },
    include: { items: true },
  });

  return NextResponse.json(updated);
}
