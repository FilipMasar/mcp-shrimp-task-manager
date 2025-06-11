import { z } from "zod";
import path from "path";
import { getResearchModePrompt } from "../../prompts/index.js";

// researchMode tool
export const researchModeSchema = z.object({
  topic: z
    .string()
    .min(5, {
      message: "Topic must be at least 5 characters, please provide a clear topic",
    })
    .describe("The content of the programming topic to be researched, should be clear and specific"),
  previousState: z
    .string()
    .optional()
    .default("")
    .describe(
      "Previous research state and content summary, empty on first execution, subsequent will include detailed and critical research results, this will help with subsequent research"
    ),
  currentState: z
    .string()
    .describe(
      "The current content that the Agent should execute, such as using network tools to search for certain keywords or analyze specific code, after research is complete, please call research_mode to record the status and integrate with the previous `previousState`, this will help you better save and execute research content"
    ),
  nextSteps: z
    .string()
    .describe(
      "Subsequent plans, steps, or research directions, used to constrain the Agent from deviating from the topic or going wrong, if you find that the research direction needs to be adjusted during the research process, please update this field"
    ),
});

export async function researchMode({
  topic,
  previousState = "",
  currentState,
  nextSteps,
}: z.infer<typeof researchModeSchema>) {
  // Get base directory path
  const DATA_DIR = process.env.DATA_DIR
  if (!DATA_DIR) throw new Error("DATA_DIR is not set");
  const MEMORY_DIR = path.join(DATA_DIR, "memory");

  // Use prompt generator to get the final prompt
  const prompt = getResearchModePrompt({
    topic,
    previousState,
    currentState,
    nextSteps,
    memoryDir: MEMORY_DIR,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: prompt,
      },
    ],
  };
}
