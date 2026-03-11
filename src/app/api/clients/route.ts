import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { createClientSchema } from "@/lib/validations";
import { sendEmail, clientInviteEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

// GET /api/clients
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

  const clients = await prisma.client.findMany({
    where: { designerId: designer.id },
    include: {
      user: { select: { name: true, email: true } },
      projects: { select: { id: true, title: true, status: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(clients);
}

// POST /api/clients – designer creates a client account
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
  const parsed = createClientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, phone, address } = parsed.data;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Check if already a client of this designer
    const existingClient = await prisma.client.findFirst({
      where: { userId: existingUser.id, designerId: designer.id },
    });
    if (existingClient) {
      return NextResponse.json({ error: "Client already exists" }, { status: 409 });
    }
  }

  // Generate a temporary password
  const tempPassword = uuidv4().slice(0, 12);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const client = await prisma.client.create({
    data: {
      phone,
      address,
      designer: { connect: { id: designer.id } },
      user: existingUser
        ? { connect: { id: existingUser.id } }
        : {
            create: {
              name,
              email,
              passwordHash,
              role: Role.CLIENT,
            },
          },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  // Send welcome email to client
  sendClientWelcomeEmail(
    email,
    session.user.name || "Your designer",
    existingUser ? undefined : tempPassword
  );

  return NextResponse.json(
    { ...client, tempPassword: existingUser ? undefined : tempPassword },
    { status: 201 }
  );
}

// Send welcome email (fire-and-forget, doesn't block response)
function sendClientWelcomeEmail(
  email: string,
  designerName: string,
  tempPassword?: string
) {
  const invite = clientInviteEmail(
    designerName,
    "your projects",
    `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`,
    tempPassword
  );
  sendEmail({ ...invite, to: email }).catch(() => {});
}
