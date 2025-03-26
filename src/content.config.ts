import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { ProjectsSchema } from "./schemas/projects";

const projects = defineCollection({
  loader: glob({
    pattern: ["**/*.md"],
    base: "src/data/projects",
  }),
  schema: ProjectsSchema,
});
