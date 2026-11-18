/**
 * POST /api/chat: Pica's streaming chat. The logic lives in `@/pica/lib/pica/chat`.
 * No segment config here: under Cache Components a POST handler is dynamic.
 */
import { handleChat } from "@/pica/lib/pica/chat";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return handleChat(request);
}
