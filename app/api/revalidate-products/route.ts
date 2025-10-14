import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  try {
    const { proveedorId } = await req.json();
    if (!proveedorId) {
      return NextResponse.json({ ok: false, error: "proveedorId requerido" }, { status: 400 });
    }
    revalidateTag(`proveedor:${proveedorId}:product-stats:all:v2`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}
