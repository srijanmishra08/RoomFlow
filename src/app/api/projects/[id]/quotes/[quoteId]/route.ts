import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateQuotationSchema } from "@/lib/validations";

async function canAccess(projectId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return false;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return !!project && project.designerId === designer.id;
}

function calc(items: Array<{ quantity: number; unitPrice: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return { subtotal, total: subtotal };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, quoteId } = await params;
  if (!(await canAccess(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quote = await prisma.quotation.findUnique({ where: { id: quoteId } });
  if (!quote || quote.projectId !== projectId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (parsed.data.items) {
    const totals = calc(parsed.data.items);
    const updated = await prisma.quotation.update({
      where: { id: quoteId },
      data: {
        status: parsed.data.status,
        notes: parsed.data.notes,
        subtotal: totals.subtotal,
        total: totals.total,
        approvedAt: parsed.data.status === "APPROVED" ? new Date() : null,
        items: {
          deleteMany: {},
          create: parsed.data.items.map((item) => ({
            ...item,
            amount: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });
    return NextResponse.json(updated);
  }

  const updated = await prisma.quotation.update({
    where: { id: quoteId },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      approvedAt: parsed.data.status === "APPROVED" ? new Date() : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json(updated);
}
