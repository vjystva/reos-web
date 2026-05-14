/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  preset: "ts-jest",
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.test.ts",
    "<rootDir>/src/**/__tests__/**/*.test.tsx",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/.scratch/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
          module: "commonjs",
          esModuleInterop: true,
          allowJs: true,
          isolatedModules: true,
          target: "es2020",
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  // Allow scratch tests to be opted in via env flag.
  ...(process.env.INCLUDE_SCRATCH === "1"
    ? {
        testPathIgnorePatterns: ["/node_modules/", "/.next/"],
      }
    : {}),
};

module.exports = config;
