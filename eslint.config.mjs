import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "apps/web/**",
      "pnpm-lock.yaml",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.ts", "apps/worker/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
