import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  shims: false,
  splitting: false,
  sourcemap: false,
  minify: false,
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
