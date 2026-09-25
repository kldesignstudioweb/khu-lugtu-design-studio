import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import autoImport from "astro-auto-import";
import tailwindcss from "@tailwindcss/vite";

import netlify from "@astrojs/netlify";

export default defineConfig({
  site: "https://kldesignstudio.com",

  integrations: [
    sitemap(),
    robotsTxt({
      policy: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://kldesignstudio.com/sitemap-index.xml",
    }),
    autoImport(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: netlify(),
  output: "server",
});
