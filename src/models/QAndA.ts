import { z } from "astro:content";

export const QAndASchema = z.object({
  title: z.string(),
});

export type QAndA = z.infer<typeof QAndASchema>;
