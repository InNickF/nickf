import { file, glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";
import { ProjectsSchema } from "./models/projects";
import { QAndASchema } from "./models/QAndA";
import { TestimonialSchema } from "./models/testimonials";

const projects = defineCollection({
  loader: glob({
    pattern: ["**/*.md"],
    base: "src/data/projects",
  }),
  schema: ({ image }) =>
    ProjectsSchema.extend({
      cover: image(),
    }),
});

const testimonials = defineCollection({
  loader: file("src/data/testimonials/index.json", {
    parser: (text: string) => JSON.parse(text),
  }),
  schema: ({ image }) =>
    z.array(
      TestimonialSchema.extend({
        cover: image(),
      }),
    ),
});

const QAndA = defineCollection({
  loader: glob({
    pattern: ["**/*.md"],
    base: "src/data/QandA",
  }),
  schema: ({ image }) => QAndASchema,
});

export const collections = { projects, testimonials, QAndA };
