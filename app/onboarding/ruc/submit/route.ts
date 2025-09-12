import { NextResponse } from "next/server";
import { setRucOnce } from "@/lib/actions/setRucOnce";

export async function POST(req: Request) {
  const formData = await req.formData();
  const result = await setRucOnce(formData);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
