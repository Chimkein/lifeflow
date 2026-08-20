import { auth } from "@/lib/auth";
import { executeTool, DESTRUCTIVE_TOOLS } from "@/lib/ai-tools";

// Executes a delete that the AI proposed and the user confirmed via the UI.
// Only delete tools are allowed here, and executeTool is scoped to the caller's
// userId, so a user can only ever delete their own data.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { name, args } = await req.json();
  if (typeof name !== "string" || !DESTRUCTIVE_TOOLS.has(name)) {
    return Response.json({ ok: false, error: "Unsupported action" }, { status: 400 });
  }

  const result = await executeTool(session.user.id, name, (args ?? {}) as Record<string, unknown>);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
