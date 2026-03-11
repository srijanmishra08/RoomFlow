import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { v4 as uuid } from "uuid";

const ALLOWED_EXTENSIONS = new Set(["glb", "gltf", "obj", "fbx", "png", "jpg", "jpeg", "webp"]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// POST /api/upload
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

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string) || "";
  const category = (formData.get("category") as string) || "";
  const tags = (formData.get("tags") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File type .${ext} not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
      { status: 400 }
    );
  }

  const filename = `${uuid()}.${ext}`;

  // Upload to Vercel Blob storage
  const blob = await put(`assets/${filename}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const fileUrl = blob.url;
  const isModel = ["glb", "gltf", "obj", "fbx"].includes(ext);

  // Create asset record
  const asset = await prisma.asset.create({
    data: {
      designerId: designer.id,
      name: name || file.name.replace(`.${ext}`, ""),
      fileUrl,
      fileType: ext,
      thumbnail: isModel ? undefined : fileUrl,
      category: category || undefined,
      tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
