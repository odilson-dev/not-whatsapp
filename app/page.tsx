import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  MessageSquare,
  Shield,
  Users,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Real-time",
    description: "Messages sync instantly with Convex subscriptions.",
  },
  {
    icon: Users,
    title: "Groups & DMs",
    description: "Direct chats, group threads, @mentions, and statuses.",
  },
  {
    icon: Shield,
    title: "Admin tools",
    description: "Moderation panel with bans and platform oversight.",
  },
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-[#00A884] dark:bg-[#111B21] text-white">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90">
            <MessageSquare className="size-4" />
            Portfolio project
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Not WhatsApp
          </h1>

          <p className="text-lg md:text-xl text-white/80 max-w-lg mx-auto">
            A full-stack real-time chat app — like WhatsApp, but it&apos;s not.
            Built with Next.js, Convex, and Clerk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/chat">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-white rounded-sm text-[#00A884] hover:bg-gray-100 dark:bg-[#202c33] dark:text-white dark:hover:bg-[#2a3942]"
              >
                Start chatting
              </Button>
            </Link>
            <a
              href={
                process.env.NEXT_PUBLIC_GITHUB_URL ??
                "https://github.com/odilson-dev/whatsapp-clone"
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                View source
              </Button>
            </a>
          </div>
        </div>
      </div>

      <section className="border-t border-white/10 bg-black/10 px-4 py-12">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl bg-white/5 p-5 text-center sm:text-left"
            >
              <feature.icon className="mx-auto sm:mx-0 size-8 text-white/90 mb-3" />
              <h2 className="font-semibold text-lg">{feature.title}</h2>
              <p className="mt-1 text-sm text-white/70">{feature.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-white/50">
          Next.js 16 · React 19 · Convex · Clerk · Tailwind CSS
        </p>
      </section>
    </main>
  );
}
