import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function fileToBuffer(file: File) {
  return file.arrayBuffer().then((ab) => Buffer.from(ab));
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
    const BUCKET = "avatars";

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // solo para debug: listar buckets
    const list = await supabase.storage.listBuckets();
    console.log("Buckets visibles:", list.data);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });

    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Solo imágenes" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Máximo 5MB" }, { status: 413 });

    const path = `${userId}/${randomUUID()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
    const buff = await fileToBuffer(file);

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buff, {
      contentType: file.type,
      upsert: true,
    });

    if (upErr) {
      console.error("Upload error:", upErr);
      return NextResponse.json({ error: `Storage error: ${upErr.message}` }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) return NextResponse.json({ error: "No se pudo generar URL pública" }, { status: 500 });

    const updated = await prisma.cliente.update({
      where: { id_cliente: userId },
      data: { avatar_url: url },
      select: { avatar_url: true },
    });

    return NextResponse.json({ url: updated.avatar_url });
  } catch (err: any) {
    console.error("Internal avatar error:", err);
    return NextResponse.json({ error: `Interno: ${String(err?.message || err)}` }, { status: 500 });
  }
}
