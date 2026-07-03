import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { processFile, classifyUpload } from "@/lib/processing";

const ALLOWED_EXTENSIONS = new Set([
  "glb", "gltf", "obj", "fbx",
  "png", "jpg", "jpeg", "webp",
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

async function uploadFile(buffer: Buffer, filepath: string, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filepath, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return blob.url;
  } else {
    const publicDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(publicDir, { recursive: true });
    const localPath = path.join(publicDir, filepath.replace(/\//g, "-"));
    await writeFile(localPath, buffer);
    return `/uploads/${filepath.replace(/\//g, "-")}`;
  }
}

/**
 * Parse GLB/GLTF binary to extract node names.
 */
function extractGltfNodeNames(buffer: Buffer): string[] {
  const names: string[] = [];
  try {
    const magic = buffer.readUInt32LE(0);
    let jsonStr: string;
    if (magic === 0x46546c67) {
      const chunkLength = buffer.readUInt32LE(12);
      jsonStr = buffer.subarray(20, 20 + chunkLength).toString("utf-8");
    } else {
      jsonStr = buffer.toString("utf-8");
    }
    const gltf = JSON.parse(jsonStr);
    if (gltf.nodes && Array.isArray(gltf.nodes)) {
      for (const node of gltf.nodes) {
        if (node.name) names.push(node.name);
      }
    }
    if (gltf.meshes && Array.isArray(gltf.meshes)) {
      for (const mesh of gltf.meshes) {
        if (mesh.name) names.push(mesh.name);
      }
    }
  } catch {
    // Not parseable
  }
  return names;
}

// GET /api/rooms/[roomId]/revisions — list all revisions for a room
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;

  const revisions = await prisma.revision.findMany({
    where: { roomId },
    orderBy: { version: "asc" },
  });

  return NextResponse.json(revisions);
}

// POST /api/rooms/[roomId]/revisions — upload a file and create a revision
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  // Verify room exists and user owns it
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { project: true },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const designer = await prisma.designer.findUnique({
    where: { userId: session.user.id },
  });

  if (!designer || room.project.designerId !== designer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const label = (formData.get("label") as string) || "";

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

  // Read file buffer
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Upload source file
  const filename = `revisions/${roomId}/${uuid()}.${ext}`;
  const fileUrl = await uploadFile(fileBuffer, filename, file.type);

  // Extract node names if 3D file
  const nodeNames = ["glb", "gltf"].includes(ext) ? extractGltfNodeNames(fileBuffer) : [];

  // Determine mime type for image processing
  const mimeType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;

  // Check if it's an image that needs 3D generation
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);

  // Run processing pipeline (now async — generates GLB for images)
  const result = await processFile(
    fileUrl,
    file.name,
    ext,
    nodeNames,
    isImage ? new Uint8Array(fileBuffer) : undefined,
    isImage ? mimeType : undefined,
    { width: room.width, depth: room.depth, height: room.height }
  );

  // Determine next version number
  const lastRevision = await prisma.revision.findFirst({
    where: { roomId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastRevision?.version ?? 0) + 1;

  // Auto-generate label if not provided
  const revisionLabel = label || `Revision ${nextVersion}`;
  const revisionType = classifyUpload(file.name, ext);

  // Create revision record
  const revision = await prisma.revision.create({
    data: {
      roomId,
      version: nextVersion,
      label: revisionLabel,
      type: revisionType,
      status: result.status,
      sourceFileUrl: fileUrl,
      sceneUrl: result.sceneUrl,
      thumbnail: result.thumbnail,
      metadata: result.metadata as Record<string, unknown> & Record<string, never>,
    },
  });

  // If it's a ready 3D model, also update the room's modelUrl
  if (result.status === "READY" && result.sceneUrl) {
    await prisma.room.update({
      where: { id: roomId },
      data: { modelUrl: result.sceneUrl },
    });
  }

  // Log activity
  await prisma.activity.create({
    data: {
      projectId: room.project.id,
      userId: session.user.id,
      type: "REVISION_CREATED",
      message: `Created revision "${revisionLabel}" (v${nextVersion}) for ${room.name}`,
      metadata: {
        revisionId: revision.id,
        revisionType: revision.type,
        version: nextVersion,
      },
    },
  });

  return NextResponse.json(revision, { status: 201 });
}
