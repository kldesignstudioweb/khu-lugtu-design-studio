// src/types.d.ts
export interface SiteMeta {
  name: string;
  title: string;
  description: string;
  keywords: string[];
  url: string;
  logo: string;
  image: string;
  imageAlt: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  business: {
    type: string;
    industry: string;
    founded: string;
    priceRange: string;
  };
}