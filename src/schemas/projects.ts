import { z } from "astro:content";

export const AVAILABLE_TAGS = [
  "UX",
  "UI",
  "Front-End",
  "Strategy",
  "Branding",
  "Marketing",
  "Animation",
] as const;

export const AVAILABLE_TECHNOLOGIES = [
  "React",
  "Vue",
  "Wordpress",
  "Figma",
  "Photoshop",
  "Illustrator",
  "Adobe XD",
  "Blender",
] as const;

export const LinkSchema = z.object({
  href: z.string(),
  text: z.string(),
});

export const ProjectsSchema = z.object({
  title: z.string(),
  description: z.string(),
  cto: LinkSchema, // Call to action
  links: z.array(LinkSchema),
  cover: z.object({
    src: z.string(),
    alt: z.string(),
  }),
  year: z.number(),
  tags: z.array(z.enum(AVAILABLE_TAGS)),
  technologies: z.array(z.enum(AVAILABLE_TECHNOLOGIES)),
  images: z.array(
    z.object({
      src: z.string(),
      alt: z.string(),
    }),
  ),
});

export type Tags = z.infer<typeof ProjectsSchema>["tags"][number];

export type Technologies = z.infer<
  typeof ProjectsSchema
>["technologies"][number];

export type Project = z.infer<typeof ProjectsSchema>;
