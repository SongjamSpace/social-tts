/** Default: GitHub release APK (SongjamSpace/agent-connect). Override with NEXT_PUBLIC_AGENT_CONNECT_ANDROID_DOWNLOAD_URL. */
const GITHUB_RELEASE_APK_URL =
  "https://github.com/SongjamSpace/agent-connect/releases/download/v0.1.0/app-debug.apk";

export const AGENT_CONNECT_ANDROID_DOWNLOAD_URL =
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_AGENT_CONNECT_ANDROID_DOWNLOAD_URL?.trim()) ||
  GITHUB_RELEASE_APK_URL;
