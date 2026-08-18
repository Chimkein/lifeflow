import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isOllamaAvailable, listModels } from "@/lib/ollama";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const available = await isOllamaAvailable();
  const models = available ? await listModels() : [];

  return NextResponse.json({
    available,
    models: models.map((m) => ({
      name: m.name,
      size: m.size,
    })),
  });
}
