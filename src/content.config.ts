import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const works = defineCollection({
  loader: glob({
    base: "./src/content/works",
    pattern: "**/*.md",
  }),

  schema: z.object({
    slug: z.string(),
    title: z.string(),
    year: z.number(),
    category: z.enum(["Residential", "Commercial"]),
    description: z.string(),
    coverImage: z.string(),
    images: z.array(z.string()).min(1).max(10),
    featured: z.boolean().optional().default(false),
  }),
});

export const collections = {
  works,
};
