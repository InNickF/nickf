import { z } from "astro:content";

export const TestimonialSchema = z.object({
  name: z.string(),
  linkedinURL: z.string(),
  text: z.string(),
  cover: z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.string(),
  }),
});

export type Testimonial = z.infer<typeof TestimonialSchema> & {
  cover: ImageMetadata;
};
