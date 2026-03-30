import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export async function extractExhibitors(html: string) {
  const schema = z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      website: z.string().optional(),
      stand: z.string().optional(),
      country: z.string().optional(),
      linkedin: z.string().optional(),
    })
  );

  const { object } = await generateObject({
    model: openai("gpt-4.1"),
    schema,
    prompt: `
    Extract exhibitors from this HTML.
    Return structured JSON with:
    name, description, website, stand, country, linkedin.
    HTML:
    ${html}
    `,
  });

  return object;
}