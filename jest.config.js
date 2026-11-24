import { createDefaultPreset } from "ts-jest";

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
export default {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    "^serialize-error$": "<rootDir>/src/__mocks__/serialize-error.js",
    "^nanoevents$": "<rootDir>/src/__mocks__/nanoevents.js",
    "^tiny-uid$": "<rootDir>/src/__mocks__/tiny-uid.js",
  },
};