import type { Config } from "tailwindcss";
import { preset } from "@rag/config/tailwind";

const config = {
  presets: [preset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
} satisfies Config;

export default config;
