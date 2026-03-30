import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

const ExhibitorSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  logo: z.string().optional(),
  stand: z.string().optional(),
  country: z.string().optional(),
  linkedin: z.string().optional(),
  twitter: z.string().optional(),
  categories: z.array(z.string()).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export async function extractExhibitors(html: string) {
  const result = await generateObject({
    model: openai("gpt-4.1"),
    schema: z.array(ExhibitorSchema),
    prompt: `
Extract all exhibitors from this HTML.

Return structured JSON with:
name, description, website, logo, stand, country, linkedin, twitter, categories, email, phone.

HTML:
${html.slice(0, 15000)}
    `,
  });

  return result.object;
}