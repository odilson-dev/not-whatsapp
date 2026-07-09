import type { Metadata } from "next";
import { BannedGate } from "@/components/admin/BannedGate";
import { ChatPage } from "@/components/chat/ChatPage";

export const metadata: Metadata = {
  title: "Chats",
  description: "Real-time direct and group messaging.",
};

export default function Page() {
  return (
    <BannedGate>
      <ChatPage />
    </BannedGate>
  );
}
