import type { Metadata } from "next";
import { ServicesBrowser } from "@/components/services/services-browser";

export const metadata: Metadata = {
  title: "Services",
};

export default function ServicesPage() {
  return <ServicesBrowser />;
}
