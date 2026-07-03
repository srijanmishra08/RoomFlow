import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit(req, "register", 5, 60_000);
    if (limited) return limited;

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password, studioName } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "DESIGNER",
        designer: {
          create: {
            studioName: studioName || null,
          },
        },
      },
      include: { designer: true },
    });

    // Onboarding: seed a sample project + furnished living room so a new
    // designer lands in a working editor, not an empty dashboard. Best-effort.
    if (user.designer) {
      try {
        await prisma.project.create({
          data: {
            designerId: user.designer.id,
            title: "Sample Project — Get Started",
            description:
              "A demo project to explore RoomFlow. Open the Living Room, try the 🛋️ Catalog, drag furniture with the gizmos, and hit 📸 Render.",
            rooms: {
              create: {
                name: "Living Room",
                width: 6,
                depth: 5,
                height: 3,
                objects: {
                  create: [
                    { name: "Sofa", positionX: -1.2, positionZ: 1.4, scaleX: 2.1, scaleY: 0.85, scaleZ: 0.95, material: "kind:sofa", color: "#8a93a5", cost: 45000 },
                    { name: "Coffee Table", positionX: -1.1, positionZ: 0.2, scaleX: 1.1, scaleY: 0.45, scaleZ: 0.6, material: "kind:coffee-table", color: "#7a5a3e", cost: 12000 },
                    { name: "Floor Lamp", positionX: 1.8, positionZ: 1.8, scaleX: 0.35, scaleY: 1.6, scaleZ: 0.35, material: "kind:floor-lamp", color: "#c9a876", cost: 6500 },
                  ],
                },
              },
            },
          },
        });
      } catch (e) {
        console.error("Onboarding seed failed (non-fatal):", e);
      }
    }

    return NextResponse.json(
      { message: "Account created", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
