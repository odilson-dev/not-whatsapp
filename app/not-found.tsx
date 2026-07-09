import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="space-y-2">
        <p className="text-6xl font-bold text-[#00A884]">404</p>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This page doesn&apos;t exist. Head back to the chat or home page.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/chat">
          <Button className="bg-[#00A884] hover:bg-[#06cf9c]">Open chat</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    </main>
  );
}
