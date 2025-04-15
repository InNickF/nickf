import { z } from "astro:content";

export const AVAILABLE_FIELDS = [
  "UX/UI",
  "Front-End",
  "Back-End",
  "Product Strategy",
  "Branding",
  "Marketing",
  "Animation",
] as const;

export const AVAILABLE_TECHNOLOGIES = [
  "React",
  "Docker",
  "TurboRepo",
  "Next.JS",
  "TailwindCSS",
  "TypeScript",
  "VueJS",
  "Nuxt",
  "Wordpress",
  "Figma",
  "Photoshop",
  "Illustrator",
  "After Effects",
  "Adobe XD",
  "Blender",
  "Laravel",
  "PHP",
] as const;

export const LinkSchema = z.object({
  href: z.string(),
  text: z.string(),
});

export const ProjectsSchema = z.object({
  order: z.number(),
  title: z.string(),
  description: z.string(),
  role: z.string(),
  cto: LinkSchema, // Call to action
  links: z.array(LinkSchema).nullish(),
  alt: z.string(),
  date: z.string(),
  fields: z.array(z.enum(AVAILABLE_FIELDS)),
  technologies: z.array(z.enum(AVAILABLE_TECHNOLOGIES)),
  images: z
    .array(
      z.object({
        src: z.string(),
        alt: z.string(),
      }),
    )
    .nullish(),

  // Cover will be replace for astro image schema
  cover: z.object({
    src: z.string(),
    width: z.number(),
    height: z.number(),
    format: z.string(),
  }),
});

export type Fields = z.infer<typeof ProjectsSchema>["fields"][number];

export type Technologies = z.infer<
  typeof ProjectsSchema
>["technologies"][number];

export type Project = Omit<z.infer<typeof ProjectsSchema>, "cover"> & {
  cover: ImageMetadata;
};
