export interface ExtractedLink {
  id: string;
  moduleName: string;
  linkText: string;
  href: string;
  alt: string;
  alias: string;
  title: string;
  tracking: Record<string, string>;
  modulePosition: number;
  imageUrl: string | null;
  buttonText: string;
  visibleText: string;
  status: "unchecked" | "passed" | "failed";
  expectedUrl?: string;
  actualUrl?: string;
  httpStatus?: number;
  redirectCount?: number;
  loadTime?: number;
  countryMismatch?: boolean;
}
