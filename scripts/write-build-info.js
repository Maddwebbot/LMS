const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const pkg = require(path.join(projectRoot, "package.json"));

const buildInfo = {
  version: pkg.version,
  buildDate: new Date().toISOString(),
};

const outPath = path.join(projectRoot, "build-info.json");
fs.writeFileSync(outPath, JSON.stringify(buildInfo, null, 2), "utf8");
console.log("Wrote build info to", outPath);
