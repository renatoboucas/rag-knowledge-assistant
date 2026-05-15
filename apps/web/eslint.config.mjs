import config from "@rag/config/eslint/next";

const eslintConfig = [{ ignores: ["next-env.d.ts"] }, ...config];

export default eslintConfig;
