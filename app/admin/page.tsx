import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Admin",
  description: "Platform moderation and analytics console.",
};

export default function Page() {
  return <AdminDashboard />;
}
