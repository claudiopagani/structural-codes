import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "node_modules/**",
            "content/**",
            "raw-sources/**",
            "extracted/**",
            "evidence/**",
            "review/**",
            "reports/**",
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts", "scripts/**/*.ts", "tests/**/*.ts"],
        languageOptions: {
            globals: globals.node,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "no-console": "off",
            "no-undef": "off",
            "@typescript-eslint/consistent-type-imports": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "no-control-regex": "off",
        },
    },
    {
        files: ["tests/**/*.test.ts"],
        rules: {
            "@typescript-eslint/no-floating-promises": "off",
        },
    },
);
