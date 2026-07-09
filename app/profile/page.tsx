import type { Metadata } from "next";
import { ProfilePage } from "@/components/profile/ProfilePage";

export const metadata: Metadata = {
  title: "Profile",
  description: "Update your display name and profile photo.",
};

export default function Page() {
  return <ProfilePage />;
}
