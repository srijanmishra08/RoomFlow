import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { classifyUpload, processFile } from "@/lib/processing";

const ALLOWED_3D = new Set(["glb", "gltf", "obj", "fbx"]);
const ALLOWED_IMAGE = new Set(["png", "jpg", "jpeg", "webp"]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

async function uploadFile(buffer: Buffer, filepath: string, contentType: string): Promise<string> {
  // Use Vercel Blob in production, local filesystem in dev
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filepath, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return blob.url;
  } else {
    // Local filesystem fallback
    const publicDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(publicDir, { recursive: true });
    const localPath = path.join(publicDir, filepath.replace(/\//g, "-"));
    await writeFile(localPath, buffer);
    return `/uploads/${filepath.replace(/\//g, "-")}`;
  }
}

// Common furniture keywords to detect from GLTF node names
const OBJECT_PATTERNS: { pattern: RegExp; name: string; category: string }[] = [
  { pattern: /\b(sofa|couch)\b/i, name: "Sofa", category: "Seating" },
  { pattern: /\b(chair|seat|armchair|stool)\b/i, name: "Chair", category: "Seating" },
  { pattern: /\b(table|desk|console)\b/i, name: "Table", category: "Furniture" },
  { pattern: /\b(bed|mattress)\b/i, name: "Bed", category: "Furniture" },
  { pattern: /\b(lamp|light|chandelier|sconce|pendant)\b/i, name: "Lamp", category: "Lighting" },
  { pattern: /\b(shelf|shelv|bookcase|cabinet|cupboard|wardrobe|closet)\b/i, name: "Shelf", category: "Storage" },
  { pattern: /\b(rug|carpet|mat)\b/i, name: "Rug", category: "Decor" },
  { pattern: /\b(plant|flower|vase|pot)\b/i, name: "Plant", category: "Decor" },
  { pattern: /\b(mirror)\b/i, name: "Mirror", category: "Decor" },
  { pattern: /\b(tv|television|monitor|screen)\b/i, name: "TV", category: "Electronics" },
  { pattern: /\b(curtain|blind|drape)\b/i, name: "Curtain", category: "Decor" },
  { pattern: /\b(sink|basin|faucet|tap)\b/i, name: "Sink", category: "Fixtures" },
  { pattern: /\b(toilet|wc)\b/i, name: "Toilet", category: "Fixtures" },
  { pattern: /\b(shower|bath|tub)\b/i, name: "Bathtub", category: "Fixtures" },
  { pattern: /\b(door)\b/i, name: "Door", category: "Architecture" },
  { pattern: /\b(window)\b/i, name: "Window", category: "Architecture" },
  { pattern: /\b(painting|art|frame|picture)\b/i, name: "Wall Art", category: "Decor" },
  { pattern: /\b(fan|ac|air.?condition)\b/i, name: "Fan/AC", category: "Appliances" },
  { pattern: /\b(fridge|refrigerator)\b/i, name: "Refrigerator", category: "Appliances" },
  { pattern: /\b(oven|stove|microwave|cooktop)\b/i, name: "Oven", category: "Appliances" },
];

/**
 * Parse a GLB/GLTF binary to extract node names.
 * GLB format: 12-byte header, then JSON chunk with scene graph.
 */
function extractGltfNodeNames(buffer: Buffer): string[] {
  const names: string[] = [];
  try {
    // GLB: magic 0x46546C67, version, length, then JSON chunk
    const magic = buffer.readUInt32LE(0);
    let jsonStr: string;

    if (magic === 0x46546c67) {
      // GLB binary
      const chunkLength = buffer.readUInt32LE(12);
      jsonStr = buffer.subarray(20, 20 + chunkLength).toString("utf-8");
    } else {
      // Plain GLTF JSON
      jsonStr = buffer.toString("utf-8");
    }

    const gltf = JSON.parse(jsonStr);

    // Extract node names
    if (gltf.nodes && Array.isArray(gltf.nodes)) {
      for (const node of gltf.nodes) {
        if (node.name) names.push(node.name);
      }
    }

    // Extract mesh names
    if (gltf.meshes && Array.isArray(gltf.meshes)) {
      for (const mesh of gltf.meshes) {
        if (mesh.name) names.push(mesh.name);
      }
    }
  } catch {
    // Not parseable — return empty
  }
  return names;
}

function detectObjectsFromNames(names: string[]): { name: string; category: string }[] {
  const detected: { name: string; category: string }[] = [];
  const seen = new Set<string>();

  for (const nodeName of names) {
    for (const { pattern, name, category } of OBJECT_PATTERNS) {
      if (pattern.test(nodeName) && !seen.has(name)) {
        seen.add(name);
        detected.push({ name: `${name} (${nodeName})`, category });
      }
    }
  }

  // If nothing detected from patterns, treat unnamed meshes as generic objects
  if (detected.length === 0 && names.length > 0) {
    // Add top-level nodes that aren't typical scene/root names
    const skipNames = /^(scene|root|armature|skeleton|__root__|RootNode)/i;
    for (const n of names.slice(0, 20)) {
      if (!skipNames.test(n) && n.length > 1 && !seen.has(n)) {
        seen.add(n);
        detected.push({ name: n, category: "Imported" });
      }
    }
  }

  return detected;
}

function detectObjectsFromImageName(filename: string): { name: string; category: string }[] {
  const detected: { name: string; category: string }[] = [];
  const seen = new Set<string>();
  const lower = filename.toLowerCase();

  for (const { pattern, name, category } of OBJECT_PATTERNS) {
    if (pattern.test(lower) && !seen.has(name)) {
      seen.add(name);
      detected.push({ name, category });
    }
  }

  return detected;
}

// POST /api/rooms/[roomId]/upload-design — upload a 3D file or image for a room
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;

  // Verify ownership
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

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const is3D = ALLOWED_3D.has(ext);
  const isImage = ALLOWED_IMAGE.has(ext);

  if (!is3D && !isImage) {
    return NextResponse.json(
      { error: `Unsupported file type .${ext}. Allowed: ${[...ALLOWED_3D, ...ALLOWED_IMAGE].join(", ")}` },
      { status: 400 }
    );
  }

  // Read file buffer once (streams can only be read once)
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // Upload file
  const filename = `rooms/${roomId}/${uuid()}.${ext}`;
  const fileUrl = await uploadFile(fileBuffer, filename, file.type);

  let detectedObjects: { name: string; category: string }[] = [];
  let nodeNames: string[] = [];

  if (is3D) {
    // Parse 3D file for node/mesh names to detect objects
    nodeNames = extractGltfNodeNames(fileBuffer);
    detectedObjects = detectObjectsFromNames(nodeNames);

    // Set room's modelUrl to this 3D file
    await prisma.room.update({
      where: { id: roomId },
      data: { modelUrl: fileUrl },
    });
  } else {
    // For images, try to detect from filename and store as reference
    detectedObjects = detectObjectsFromImageName(file.name);
  }

  // Create RoomObject entries for each detected object
  const createdObjects = [];
  for (let i = 0; i < detectedObjects.length; i++) {
    const obj = detectedObjects[i];
    const roomObject = await prisma.roomObject.create({
      data: {
        roomId,
        name: obj.name,
        material: obj.category,
        // Spread objects in a grid pattern
        positionX: (i % 4) * 2 - 3,
        positionY: 0,
        positionZ: Math.floor(i / 4) * 2 - 2,
        status: "PLANNED",
      },
    });
    createdObjects.push(roomObject);
  }

  // Auto-create a revision record for tracking
  const lastRevision = await prisma.revision.findFirst({
    where: { roomId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastRevision?.version ?? 0) + 1;
  const revisionType = classifyUpload(file.name, ext);

  // For image uploads, run the processing pipeline to generate 3D
  let sceneUrl: string | null = is3D ? fileUrl : null;
  let revisionStatus = "READY";
  let processingMetadata: Record<string, unknown> = {};

  if (isImage) {
    const mimeType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;
    const result = await processFile(
      fileUrl,
      file.name,
      ext,
      [],
      new Uint8Array(fileBuffer),
      mimeType,
      { width: room.width, depth: room.depth, height: room.height }
    );
    sceneUrl = result.sceneUrl;
    revisionStatus = result.status;
    processingMetadata = result.metadata;
  }

  const revision = await prisma.revision.create({
    data: {
      roomId,
      version: nextVersion,
      label: `Upload v${nextVersion}`,
      type: revisionType,
      status: revisionStatus as "READY" | "PROCESSING" | "FAILED",
      sourceFileUrl: fileUrl,
      sceneUrl,
      thumbnail: !is3D ? fileUrl : null,
      metadata: { detectedObjects: createdObjects.map((o) => o.name), nodeNames, ...processingMetadata },
    },
  });

  // If a sceneUrl was generated, update the room's modelUrl
  if (sceneUrl && !is3D) {
    await prisma.room.update({
      where: { id: roomId },
      data: { modelUrl: sceneUrl },
    });
  }

  return NextResponse.json({
    fileUrl,
    fileType: is3D ? "3d" : "image",
    detectedObjects: createdObjects,
    nodeNames,
    revisionId: revision.id,
    revisionVersion: revision.version,
    sceneUrl,
    message: createdObjects.length > 0
      ? `Uploaded and detected ${createdObjects.length} object(s) (Revision v${nextVersion})`
      : sceneUrl
        ? `Uploaded and 3D scene generated (Revision v${nextVersion})`
        : `Uploaded successfully as Revision v${nextVersion}. No objects auto-detected — you can add them manually.`,
  }, { status: 201 });
}
