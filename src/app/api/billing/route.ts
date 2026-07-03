import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/billing — get invoices + summary for the designer
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

  const invoices = await prisma.invoice.findMany({
    where: { designerId: designer.id },
    include: {
      client: { include: { user: { select: { name: true, email: true } } } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Summary stats
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.total, 0);
  const totalPending = invoices
    .filter((inv) => inv.status === "SENT" || inv.status === "OVERDUE")
    .reduce((sum, inv) => sum + inv.total, 0);

  // Get clients for the invoice form dropdown
  const clients = await prisma.client.findMany({
    where: { designerId: designer.id },
    include: { user: { select: { name: true, email: true } } },
  });

  const projects = await prisma.project.findMany({
    where: { designerId: designer.id },
    select: { id: true, title: true, clientId: true },
  });

  return NextResponse.json({
    invoices,
    clients,
    projects,
    summary: {
      totalBilled,
      totalPaid,
      totalPending,
      invoiceCount: invoices.length,
    },
  });
}

// POST /api/billing — create a new invoice
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
  const { clientId, projectId, title, description, items, tax, currency, dueDate, notes } = body;

  if (!clientId || !title || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "clientId, title, and at least one item are required" },
      { status: 400 }
    );
  }

  // Verify client belongs to this designer
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.designerId !== designer.id) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Calculate totals
  const subtotal = items.reduce(
    (sum: number, item: { quantity: number; rate: number }) =>
      sum + (item.quantity || 1) * (item.rate || 0),
    0
  );
  const taxAmount = typeof tax === "number" ? tax : 0;
  const total = subtotal + taxAmount;

  // Generate invoice number
  const count = await prisma.invoice.count({ where: { designerId: designer.id } });
  const number = `INV-${String(count + 1).padStart(3, "0")}`;

  const invoice = await prisma.invoice.create({
    data: {
      designerId: designer.id,
      clientId,
      projectId: projectId || null,
      number,
      title,
      description: description || null,
      items,
      subtotal,
      tax: taxAmount,
      total,
      currency: currency || "INR",
      status: "DRAFT",
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
    },
    include: {
      client: { include: { user: { select: { name: true, email: true } } } },
      project: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}

// PATCH /api/billing — update invoice status
export async function PATCH(req: NextRequest) {
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
  const { invoiceId, status } = body;

  if (!invoiceId || !status) {
    return NextResponse.json({ error: "invoiceId and status are required" }, { status: 400 });
  }

  const validStatuses = ["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.designerId !== designer.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: status as any,
      paidAt: status === "PAID" ? new Date() : invoice.paidAt,
    },
    include: {
      client: { include: { user: { select: { name: true, email: true } } } },
      project: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(updated);
}
