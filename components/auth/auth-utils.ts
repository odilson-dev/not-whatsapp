type NavigateArgs = {
  decorateUrl: (url: string) => string;
  session?: { currentTask?: { key: string } | null } | null;
};

type RouterLike = {
  push: (href: string) => void;
};

export const AFTER_AUTH_PATH = "/chat";
export const SSO_CALLBACK_PATH = "/sso-callback";
export const SIGN_IN_PATH = "/sign-in";

export function absoluteUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
}

export function navigateAfterAuth(
  router: RouterLike,
  { decorateUrl, session }: NavigateArgs,
) {
  if (session?.currentTask) {
    return;
  }

  const url = decorateUrl(AFTER_AUTH_PATH);
  if (url.startsWith("http")) {
    window.location.href = url;
    return;
  }

  router.push(url);
}

export function fieldErrorMessage(
  error: { message?: string; longMessage?: string } | null | undefined,
): string | undefined {
  return error?.longMessage ?? error?.message;
}

export function globalErrorMessage(
  errors: { message?: string; longMessage?: string }[] | null | undefined,
): string | undefined {
  const first = errors?.[0];
  return first?.longMessage ?? first?.message;
}
