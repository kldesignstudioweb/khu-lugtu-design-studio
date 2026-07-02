// src/config/site.ts
import type { SiteMeta } from '@/types';

// Centralized site configuration
export const SITE_CONFIG: SiteMeta = {
  // Basic SEO
  name: "Your Business Name",
  title: "Your Business Name | Professional Web Design & Development",
  description: "Your Business Name creates fast, modern, and user-friendly websites. Get your professional website today.",
  keywords: ["web design", "web development", "website creation"],
  
  // URLs and Images
  url: "https://yourdomain.com",
  logo: "/logo.png",
  image: "/og-image.jpg",
  imageAlt: "A clean and modern website design",

  // Social Media
  twitter: "@yourbusiness",
  facebook: "yourbusiness",
  linkedin: "company/yourbusiness",

  // Business Information
  business: {
    type: "LocalBusiness",
    industry: "Web Design & Development",
    founded: "2025",
    priceRange: "$$"
  },
};