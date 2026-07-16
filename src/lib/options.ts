// Shared dropdown vocabularies for Work. UI-level lists (DB stores plain text)
// so extending them is a one-line change here.

export const SECTOR_OPTIONS = [
  { value: "hospitality", label: "Hospitality" },
  { value: "tourism", label: "Tourism & travel" },
  { value: "food-beverage", label: "Food & beverage" },
  { value: "visa-consultancy", label: "Visa & consultancy" },
  { value: "retail-ecommerce", label: "Retail & e-commerce" },
  { value: "health", label: "Health & wellness" },
  { value: "education", label: "Education" },
  { value: "real-estate", label: "Real estate" },
  { value: "logistics", label: "Logistics" },
  { value: "finance", label: "Finance" },
  { value: "software", label: "Software & tech" },
  { value: "media", label: "Media & content" },
  { value: "internal", label: "Kagu internal" },
  { value: "other", label: "Other" },
];

export const PROJECT_TYPE_OPTIONS = [
  { value: "static-website", label: "Static website" },
  { value: "dynamic-website", label: "Dynamic website" },
  { value: "web-app", label: "Web app / SaaS" },
  { value: "internal-system", label: "Internal system" },
  { value: "mobile-app", label: "Mobile app" },
  { value: "desktop-app", label: "Desktop app" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "digital-menu-pos", label: "Digital menu / POS" },
  { value: "api-integration", label: "API / integration" },
  { value: "bot-automation", label: "Bot / automation" },
  { value: "design-branding", label: "Design / branding" },
  { value: "other", label: "Other" },
];

export const CHANNEL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "google-ads", label: "Google Ads" },
  { value: "meta-ads", label: "Meta Ads" },
  { value: "email", label: "Email" },
  { value: "seo", label: "SEO" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
];

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "done", label: "Done" },
];

export function optionLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined
) {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}
