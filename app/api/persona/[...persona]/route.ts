import { createPersonaHandler } from "@personaai/adapters/nextjs/server";

const UID_COOKIE = "shuttlelive_uid";
const UID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function visitorId(req: Request): string | null {
  const cookies = req.headers.get("cookie") ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${UID_COOKIE}=([^;]+)`));
  const id = match?.[1];
  return id && UID_PATTERN.test(id) ? `shuttle-${id}` : null;
}

type Handlers = ReturnType<typeof createPersonaHandler>;
let cached: Handlers | null = null;

function getHandlers(): Handlers | null {
  const credential = process.env.PERSONA_CREDENTIAL;
  if (!credential) return null;
  if (!cached) {
    cached = createPersonaHandler({
      baseUrl: process.env.PERSONA_BASE_URL ?? "https://api.persona.hasanraiyan.me",
      credential,
      mountPath: "/api/persona",
      resolveUserFrom: visitorId,
    });
  }
  return cached;
}

function dispatch(method: keyof Handlers) {
  return (req: Request, ctx: { params: Promise<{ persona: string[] }> }) => {
    const handlers = getHandlers();
    if (!handlers) {
      return Response.json(
        { error: "Persona assistant is not configured (missing PERSONA_CREDENTIAL)." },
        { status: 503 },
      );
    }
    return (handlers[method] as (req: Request, ctx: unknown) => Promise<Response>)(req, ctx);
  };
}

export const GET = dispatch("GET");
export const POST = dispatch("POST");
export const PUT = dispatch("PUT");
export const PATCH = dispatch("PATCH");
export const DELETE = dispatch("DELETE");
