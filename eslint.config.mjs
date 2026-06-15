import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "hooks/useCandles.ts",
      "hooks/useLivePrice.ts",
      "hooks/usePushNotifications.ts",
    ],
    rules: {
      // Intentional reset when symbol/adapter changes before async subscription setup
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["hooks/useSignal.ts"],
    rules: {
      // Live signal expiry uses wall-clock time on each render
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
