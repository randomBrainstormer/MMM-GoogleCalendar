const fs = require("fs");
const path = require("path");

const additionalConfigPath = path.resolve(__dirname, "../../.eslintrc.json");

const baseConfig = {
  extends: ["eslint:recommended"]
};

if (fs.existsSync(additionalConfigPath)) {
  baseConfig.extends.push(additionalConfigPath);
}

module.exports = baseConfig;
