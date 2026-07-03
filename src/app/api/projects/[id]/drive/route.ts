import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDriveItemSchema } from "@/lib/validations";
import { PROJECT_DRIVE_ROOT_FOLDERS } from "@/lib/workflow";
import { v4 as uuid } from "uuid";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS = new Set([
  "glb", "gltf", "obj", "fbx", "skp", "rvt", "dwg", "dxf",
  "png", "jpg", "jpeg", "webp", "pdf", "doc", "docx", "xlsx", "csv", "mp4",
]);

async function uploadFile(buffer: Buffer, filepath: string, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filepath, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const localPath = path.join(dir, filepath.replace(/\//g, "-"));
  await writeFile(localPath, buffer);
  return `/uploads/${filepath.replace(/\//g, "-")}`;
}

async function getDesignerBySessionUser(userId: string) {
  return prisma.designer.findUnique({ where: { userId } });
}

async function getOwnedProject(projectId: string, userId: string) {
  const designer = await getDesignerBySessionUser(userId);
  if (!designer) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.designerId !== designer.id) return null;
  return project;
}

async function ensureRootFolders(projectId: string, userId: string) {
  const existingRoots = await prisma.driveItem.findMany({
    where: { projectId, parentId: null, type: "FOLDER" },
    select: { name: true },
  });

  const names = new Set(existingRoots.map((r) => r.name));
  const missing = PROJECT_DRIVE_ROOT_FOLDERS.filter((folder) => !names.has(folder));

  if (missing.length === 0) return;

  await prisma.driveItem.createMany({
    data: missing.map((name) => ({
      projectId,
      createdById: userId,
      type: "FOLDER",
      name,
      tags: [],
      phase: name,
    })),
  });
}

function buildTree(items: Array<any>, parentId: string | null = null): Array<any> {
  return items
    .filter((item) => (item.parentId ?? null) === parentId)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "FOLDER" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .map((item) => ({
      ...item,
      children: buildTree(items, item.id),
    }));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const project = await getOwnedProject(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
  }

  await ensureRootFolders(projectId, session.user.id);

  const roomId = req.nextUrl.searchParams.get("roomId");
  const phase = req.nextUrl.searchParams.get("phase");

  const items = await prisma.driveItem.findMany({
    where: {
      projectId,
      ...(roomId ? { roomId } : {}),
      ...(phase ? { phase } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    items,
    tree: buildTree(items),
  });
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
  const project = await getOwnedProject(projectId, session.user.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found or forbidden" }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const parentId = (formData.get("parentId") as string) || null;
    const roomId = (formData.get("roomId") as string) || null;
    const phase = (formData.get("phase") as string) || null;
    const tags = ((formData.get("tags") as string) || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `File type .${ext} is not supported` }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `drive/${projectId}/${uuid()}-${file.name.replace(/\s+/g, "-")}`;
    const url = await uploadFile(bytes, filename, file.type || "application/octet-stream");

    const driveItem = await prisma.driveItem.create({
      data: {
        projectId,
        roomId,
        parentId,
        createdById: session.user.id,
        type: "FILE",
        name: file.name,
        phase,
        mimeType: file.type || undefined,
        extension: ext || undefined,
        sizeBytes: file.size,
        url,
        previewUrl: ["png", "jpg", "jpeg", "webp", "pdf"].includes(ext) ? url : null,
        tags,
        is3D: ["glb", "gltf", "obj", "fbx", "skp", "rvt"].includes(ext),
        metadata: {
          uploadedFrom: "drive",
        },
      },
    });

    return NextResponse.json(driveItem, { status: 201 });
  }

  const body = await req.json();
  const parsed = createDriveItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const item = await prisma.driveItem.create({
    data: {
      projectId,
      createdById: session.user.id,
      parentId: parsed.data.parentId ?? null,
      roomId: parsed.data.roomId ?? null,
      name: parsed.data.name,
      phase: parsed.data.phase ?? null,
      type: parsed.data.type,
      externalUrl: parsed.data.externalUrl ?? null,
      tags: parsed.data.tags,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
