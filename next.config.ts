import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
};

const sentryOptions = {
  org: process.env.SENTRY_ORG ?? "shogunate",
  project: process.env.SENTRY_PROJECT ?? "war-room",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
};

// Only wrap with Sentry if auth token is present — prevents build crash in local dev
const baseConfig = withSerwist(nextConfig);

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(baseConfig, sentryOptions)
  : baseConfig;
