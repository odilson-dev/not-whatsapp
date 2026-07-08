import { BannedGate } from "@/components/admin/BannedGate";
import { ChatPage } from "@/components/chat/ChatPage";

export default function Page() {
  return (
    <BannedGate>
      <ChatPage />
    </BannedGate>
  );
}
