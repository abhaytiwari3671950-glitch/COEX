import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) return Response.json({error: "Invalid origin."}, {status: 403});
  const session = await auth.api.getSession({headers: await headers()});
  if (!session) return Response.json({error: "Sign in to use file tools."}, {status: 401});
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return Response.json({error: "File tools are not configured."}, {status: 503});
  let action: unknown;
  try { ({action} = await request.json()); } catch { return Response.json({error: "Invalid request."}, {status: 400}); }
  if (action !== "inspect" && action !== "create_pdf") return Response.json({error: "Unsupported action."}, {status: 400});
  const payload = Buffer.from(JSON.stringify({sub: session.user.id, aud: "coex-media", action, exp: Math.floor(Date.now()/1000)+300})).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return Response.json({token: `${payload}.${signature}`}, {headers: {"Cache-Control": "no-store"}});
}
