import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // AWS Lambda build output (aws/build-lambda.mjs)
    "aws/dist/**",
    // Static files served as they are (minified third-party scripts), not source.
    "public/**",
  ]),
  {
    rules: {
      // The site serves plain <img> on purpose: next/image needs Next.js's image
      // optimizer, which the AWS Lambda build leaves out (no sharp).
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
