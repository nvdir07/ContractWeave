import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: { strict: true } }],
  },
  // Exclude fixture TS files from test discovery
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/fixtures/"],
};

export default config;
