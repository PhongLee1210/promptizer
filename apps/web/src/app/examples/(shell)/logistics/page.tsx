import type { Metadata } from "next";

import { Logistics } from "./_components/logistics";

import "@/styles/flag-icons/flags.css";

export const metadata: Metadata = {
  title: "Open Source Logistics Dashboard with shadcn/ui",
  description:
    "Explore an open source logistics dashboard with shipment tracking, delivery status, route maps, cargo details, and transport information.",
  alternates: {
    canonical: "/examples/logistics",
  },
};

export default function Page() {
  return <Logistics />;
}
