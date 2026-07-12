import { Button } from "@/components/ui/button";
import { HeartHandshake, MessageCircleHeart, Sparkles } from "lucide-react";
import Link from "next/link";

const highlights = [
  {
    icon: MessageCircleHeart,
    title: "Chat that feels alive",
    description:
      "Messages appear the moment they're sent — no refresh, no waiting around.",
  },
  {
    icon: HeartHandshake,
    title: "Friends, groups, and you",
    description:
      "Catch up one-on-one, hang out in groups, or share a quick status update.",
  },
  {
    icon: Sparkles,
    title: "Simple from the start",
    description:
      "Sign up, say hello, and you're in. No fuss — just a place to talk.",
  },
];

const previewBubbles = [
  {
    from: "them",
    text: "Hey! Glad you made it 👋",
    delay: "0ms",
  },
  {
    from: "me",
    text: "Hi! This feels cozy already.",
    delay: "120ms",
  },
  {
    from: "them",
    text: "Pull up a seat — everyone’s welcome here.",
    delay: "240ms",
  },
] as const;

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#00A884] text-white dark:bg-[#111B21]">
      {/* Soft atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.22)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(6,207,156,0.35)_0%,_transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(0,168,132,0.28)_0%,_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(83,189,235,0.12)_0%,_transparent_45%)]"
      />
      <div
        aria-hidden
        className="landing-doodle pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.05]"
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-16 md:py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <div className="max-w-xl space-y-6 text-center lg:text-left">
            <p className="landing-fade-up text-sm font-medium tracking-wide text-white/75">
              A friendly place to talk
            </p>

            <h1 className="landing-fade-up landing-delay-1 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              Not WhatsApp
            </h1>

            <p className="landing-fade-up landing-delay-2 text-xl font-medium text-white/95 sm:text-2xl">
              Come say hi.
            </p>

            <p className="landing-fade-up landing-delay-3 mx-auto max-w-md text-base text-white/80 sm:text-lg lg:mx-0">
              Real-time chats with the people you care about — warm, simple, and
              always ready when you are.
            </p>

            <div className="landing-fade-up landing-delay-4 flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row lg:justify-start">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="w-full rounded-full bg-white px-8 text-[#008069] shadow-md transition-transform hover:scale-[1.02] hover:bg-white/95 sm:w-auto dark:bg-[#202c33] dark:text-white dark:hover:bg-[#2a3942]"
                >
                  Start chatting
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full border-white/35 bg-transparent px-8 text-white transition-colors hover:bg-white/10 sm:w-auto"
                >
                  Welcome back
                </Button>
              </Link>
            </div>

            <p className="landing-fade-up landing-delay-5 pt-1 text-sm text-white/65">
              <a
                href={
                  process.env.NEXT_PUBLIC_GITHUB_URL ??
                  "https://github.com/odilson-dev/whatsapp-clone"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline"
              >
                Peek at the source
              </a>
              <span className="mx-2 text-white/35">·</span>
              Free to try — jump in anytime
            </p>
          </div>

          {/* Friendly chat preview */}
          <div
            aria-hidden
            className="landing-fade-up landing-delay-3 w-full max-w-sm"
          >
            <div className="relative rounded-3xl bg-black/10 p-5 shadow-[0_20px_60px_-24px_rgba(0,0,0,0.35)] ring-1 ring-white/15 backdrop-blur-sm dark:bg-white/5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#06CF9C] text-sm font-semibold text-[#003528]">
                  NW
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">Welcome chat</p>
                  <p className="text-xs text-white/60">online · say hello</p>
                </div>
              </div>

              <div className="space-y-3">
                {previewBubbles.map((bubble) => (
                  <div
                    key={bubble.text}
                    className={`landing-bubble flex ${
                      bubble.from === "me" ? "justify-end" : "justify-start"
                    }`}
                    style={{ animationDelay: bubble.delay }}
                  >
                    <p
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed shadow-sm ${
                        bubble.from === "me"
                          ? "rounded-br-md bg-[#D9FDD3] text-[#111B21] dark:bg-[#005C4B] dark:text-[#E9EDEF]"
                          : "rounded-bl-md bg-white text-[#111B21] dark:bg-[#202C33] dark:text-[#E9EDEF]"
                      }`}
                    >
                      {bubble.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 ring-1 ring-white/10">
                <span className="flex-1 text-left text-xs text-white/50">
                  Type a friendly hello…
                </span>
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#008069] dark:bg-[#00A884] dark:text-white">
                  Send
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="relative z-10 border-t border-white/10 bg-black/10 px-4 py-14 backdrop-blur-[2px]">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-sm font-medium text-white/70">
            Built for easy conversations
          </p>
          <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
            {highlights.map((item) => (
              <div key={item.title} className="text-center sm:text-left">
                <item.icon
                  className="mx-auto mb-3 size-7 text-white/90 sm:mx-0"
                  strokeWidth={1.75}
                />
                <h2 className="text-base font-semibold">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-xs text-white/45">
            Next.js · Convex · Clerk · made with care
          </p>
        </div>
      </section>
    </main>
  );
}
