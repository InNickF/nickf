// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://nickf.info",
  base: "/",
  trailingSlash: "ignore",
  prefetch: {
    defaultStrategy: "viewport",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [partytown(), react(), vue(), sitemap()],
  output: "static",
  adapter: cloudflare(),
});
