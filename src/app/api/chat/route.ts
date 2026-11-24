import { convertToCoreMessages, streamText } from "ai";
import { auth } from "@/auth";
import { aiProvider, chatModel } from "@/ai/models";
import { buildFinanceTools, chatSystemPrompt } from "@/ai/tools";
import { todayIso } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorised", { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const messages = Array.isArray(body?.messages) ? body.messages : [];

  if (aiProvider() === null) {
    return new Response(
      "Chat is not set up yet: no AI provider key is configured on the server.",
      { status: 503 }
    );
  }

  try {
    const result = await streamText({
      model: chatModel(),
      system: chatSystemPrompt(todayIso()),
      messages: convertToCoreMessages(messages),
      tools: buildFinanceTools(userId),
      maxSteps: 5,
      temperature: 0.2,
    });

    return result.toDataStreamResponse({
      getErrorMessage: () =>
        "The AI provider returned an error part way through. Please try again.",
    });
  } catch (error) {
    console.error("Chat request failed:", error);
    const rateLimited =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      (error as { statusCode?: number }).statusCode === 429;
    return new Response(
      rateLimited
        ? "The AI provider's free-tier rate limit was reached. Wait a minute and try again."
        : "The AI provider rejected the request. Check the API key and model settings.",
      { status: rateLimited ? 429 : 502 }
    );
  }
}
