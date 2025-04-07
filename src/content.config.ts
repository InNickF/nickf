import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { ProjectsSchema } from "./models/projects";
import type { z } from "astro:schema";

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

export const collections = { projects };
