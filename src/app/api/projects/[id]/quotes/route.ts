import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createQuotationSchema } from "@/lib/validations";

async function canAccess(projectId: string, userId: string) {
  const designer = await prisma.designer.findUnique({ where: { userId } });
  if (!designer) return false;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  return !!project && project.designerId === designer.id;
}

function calculateTotals(items: Array<{ quantity: number; unitPrice: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return {
    subtotal,
    total: subtotal,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  if (!(await canAccess(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quotes = await prisma.quotation.findMany({
    where: { projectId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(quotes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  if (!(await canAccess(projectId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const totals = calculateTotals(parsed.data.items);

  const quote = await prisma.quotation.create({
    data: {
      projectId,
      status: parsed.data.status,
      currency: parsed.data.currency,
      notes: parsed.data.notes,
      subtotal: totals.subtotal,
      total: totals.total,
      items: {
        create: parsed.data.items.map((item) => ({
          ...item,
          amount: item.quantity * item.unitPrice,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(quote, { status: 201 });
}
