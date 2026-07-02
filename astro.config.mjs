import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import autoImport from "astro-auto-import";

export default defineConfig({
  site: "https://www.yourprojectdomain.com", // 🔁 Replace with your real domain
  integrations: [
    sitemap(),
    robotsTxt({
      policy: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://www.yourprojectdomain.com/sitemap-index.xml",
    }),
    autoImport(),
  ],
});
