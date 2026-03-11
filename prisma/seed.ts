import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create designer user
  const passwordHash = await bcrypt.hash("password123", 12);

  const designerUser = await prisma.user.upsert({
    where: { email: "designer@roomflow.app" },
    update: {},
    create: {
      name: "Demo Designer",
      email: "designer@roomflow.app",
      passwordHash,
      role: "DESIGNER",
      designer: {
        create: {
          studioName: "RoomFlow Studio",
          bio: "A demo interior design studio",
        },
      },
    },
    include: { designer: true },
  });

  const designerId = designerUser.designer!.id;

  // Create client user
  const clientUser = await prisma.user.upsert({
    where: { email: "client@example.com" },
    update: {},
    create: {
      name: "Demo Client",
      email: "client@example.com",
      passwordHash,
      role: "CLIENT",
      client: {
        create: {
          designerId,
          phone: "+91 9876543210",
          address: "Mumbai, India",
        },
      },
    },
    include: { client: true },
  });

  const clientId = clientUser.client!.id;

  // Create project
  const project = await prisma.project.create({
    data: {
      title: "Modern Living Room",
      description:
        "A contemporary living room redesign with minimalist furniture and warm tones.",
      designerId,
      clientId,
      status: "ACTIVE",
    },
  });

  // Create rooms
  const livingRoom = await prisma.room.create({
    data: {
      projectId: project.id,
      name: "Living Room",
      width: 8,
      height: 3,
      depth: 6,
    },
  });

  const bedroom = await prisma.room.create({
    data: {
      projectId: project.id,
      name: "Master Bedroom",
      width: 5,
      height: 3,
      depth: 5,
    },
  });

  // Add objects to living room
  const sofa = await prisma.roomObject.create({
    data: {
      roomId: livingRoom.id,
      name: "L-Shape Sofa",
      positionX: -1.5,
      positionY: 0,
      positionZ: 1,
      status: "FINALIZED",
      material: "Linen",
      brand: "IKEA",
      supplier: "IKEA India",
      cost: 42000,
      currency: "INR",
      color: "#8B7355",
    },
  });

  await prisma.roomObject.create({
    data: {
      roomId: livingRoom.id,
      name: "Coffee Table",
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      scaleX: 1.2,
      scaleY: 0.5,
      scaleZ: 0.8,
      status: "IN_PROGRESS",
      material: "Walnut Wood",
      brand: "Urban Ladder",
      cost: 18000,
      currency: "INR",
      color: "#654321",
    },
  });

  await prisma.roomObject.create({
    data: {
      roomId: livingRoom.id,
      name: "Floor Lamp",
      positionX: 2.5,
      positionY: 0,
      positionZ: -1.5,
      scaleX: 0.3,
      scaleY: 1.5,
      scaleZ: 0.3,
      status: "PLANNED",
      material: "Brass + Fabric",
      brand: "West Elm",
      cost: 8500,
      currency: "INR",
      color: "#D4AF37",
    },
  });

  await prisma.roomObject.create({
    data: {
      roomId: livingRoom.id,
      name: "TV Unit",
      positionX: 0,
      positionY: 0,
      positionZ: -2.5,
      scaleX: 2,
      scaleY: 0.6,
      scaleZ: 0.4,
      status: "FINALIZED",
      material: "MDF + Veneer",
      brand: "Custom",
      cost: 35000,
      currency: "INR",
      color: "#2C2C2C",
    },
  });

  // Add objects to bedroom
  await prisma.roomObject.create({
    data: {
      roomId: bedroom.id,
      name: "King Bed",
      positionX: 0,
      positionY: 0,
      positionZ: -1,
      scaleX: 1.8,
      scaleY: 0.5,
      scaleZ: 2,
      status: "FINALIZED",
      material: "Teak Wood + Upholstery",
      brand: "Godrej Interio",
      cost: 65000,
      currency: "INR",
      color: "#8B4513",
    },
  });

  await prisma.roomObject.create({
    data: {
      roomId: bedroom.id,
      name: "Bedside Table",
      positionX: -1.5,
      positionY: 0,
      positionZ: -1,
      scaleX: 0.5,
      scaleY: 0.6,
      scaleZ: 0.5,
      status: "IN_PROGRESS",
      material: "Wood",
      cost: 12000,
      currency: "INR",
      color: "#A0522D",
    },
  });

  // Add comments
  await prisma.comment.create({
    data: {
      objectId: sofa.id,
      userId: clientUser.id,
      content: "Love the fabric choice! Can we also see a grey option?",
    },
  });

  await prisma.comment.create({
    data: {
      objectId: sofa.id,
      userId: designerUser.id,
      content: "Sure, I'll prepare a grey linen sample for next week.",
    },
  });

  // Create an asset
  await prisma.asset.create({
    data: {
      designerId,
      name: "Modern Chair",
      fileUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb",
      fileType: "glb",
      category: "Furniture",
      tags: ["chair", "modern", "living room"],
    },
  });

  await prisma.asset.create({
    data: {
      designerId,
      name: "Wooden Box",
      fileUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Box/glTF-Binary/Box.glb",
      fileType: "glb",
      category: "Furniture",
      tags: ["box", "wood", "storage"],
    },
  });

  // Create subscription (Free tier for demo)
  await prisma.subscription.upsert({
    where: { userId: designerUser.id },
    update: {},
    create: {
      userId: designerUser.id,
      plan: "FREE",
    },
  });

  // Create activity log entries
  await prisma.activity.createMany({
    data: [
      {
        projectId: project.id,
        userId: designerUser.id,
        type: "PROJECT_CREATED",
        message: 'Created project "Modern Living Room"',
      },
      {
        projectId: project.id,
        userId: designerUser.id,
        type: "ROOM_CREATED",
        message: 'Added room "Living Room"',
      },
      {
        projectId: project.id,
        userId: designerUser.id,
        type: "ROOM_CREATED",
        message: 'Added room "Master Bedroom"',
      },
      {
        projectId: project.id,
        userId: designerUser.id,
        type: "OBJECT_ADDED",
        message: 'Added object "L-Shape Sofa"',
      },
      {
        projectId: project.id,
        userId: designerUser.id,
        type: "CLIENT_INVITED",
        message: "Invited Demo Client to the project",
      },
      {
        projectId: project.id,
        userId: clientUser.id,
        type: "COMMENT_ADDED",
        message: 'Commented on "L-Shape Sofa"',
      },
    ],
  });

  // Create a sample approval
  await prisma.approval.create({
    data: {
      objectId: sofa.id,
      userId: clientUser.id,
      status: "APPROVED",
      note: "Looks great!",
    },
  });

  // Create sample notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: designerUser.id,
        title: "New Comment",
        message: 'Demo Client commented on "L-Shape Sofa"',
        link: `/dashboard/projects/${project.id}`,
      },
      {
        userId: designerUser.id,
        title: "Object Approved",
        message: 'Demo Client approved "L-Shape Sofa"',
        link: `/dashboard/projects/${project.id}`,
        read: true,
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`
  📧 Designer login: designer@roomflow.app / password123
  📧 Client login:   client@example.com / password123
  🔗 Client portal:  /portal/${project.id}
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
