import 'dotenv/config';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";


// --------------------
// ZOD SCHEMAS
// --------------------

// Input validation
const CharacterInputSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  message: z.string().min(1).max(300),
});

// Output validation (AI MUST follow this)
const CharacterReplySchema = z.object({
  reply: z
    .string()
    .min(1)
    .max(200)
    .describe("A short, in-character one-liner reply"),
});

// --------------------
// MODEL
// --------------------

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash-lite",
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.7,
  maxOutputTokens: 60,
});

// Force structured output
const structuredModel = model.withStructuredOutput(CharacterReplySchema);


// --------------------
// MAIN FUNCTION
// --------------------

export async function talkToCharacter(from, to, message) {
  // 1. Validate input
  const input = CharacterInputSchema.parse({ from, to, message });

  // Prevent talking to self
  if (input.from === input.to) {
    return "";
  }

  // 2. Prompt
  const prompt = `
You are ${input.to} from Friends.
Stay fully in character.
Reply with ONE short line of dialogue only.
No narration. No explanations.

${input.from} said: "${input.message}"
`;

  try {
    // 3. Call AI (schema-enforced)
    const result = await structuredModel.invoke([
      new HumanMessage(prompt),
    ]);

    // 4. Zod guarantees result.reply exists
    return result.reply.trim();

  } catch (err) {
    console.error("AI failed:", err.message);
    return "...awkward silence...";
  }
}
