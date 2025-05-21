const fs = require("fs");
const path = require("path");

const additionalConfigPath = path.resolve(__dirname, "../../.eslintrc.json");

const baseConfig = {
  env: {
    browser: true, // For MMM-GoogleCalendar.js
    node: true,    // For node_helper.js
    es6: true,
    jest: true     // Added for Jest testing environment
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "script"
  },
  globals: {
    Module: "readonly",
    Log: "readonly",
    moment: "readonly",
    config: "readonly"
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-prototype-builtins": "warn"
  }
};

if (fs.existsSync(additionalConfigPath)) {
  baseConfig.extends.push(additionalConfigPath);
}

module.exports = baseConfig;
