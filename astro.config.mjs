import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import autoImport from "astro-auto-import";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://kldesignstudio.com",

  integrations: [
    sitemap(),
    robotsTxt({
      policy: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://www.yourprojectdomain.com/sitemap-index.xml",
    }),
    autoImport(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});