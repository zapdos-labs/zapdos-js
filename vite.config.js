import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "Zapdos", // global variable name
      formats: ["es", "cjs", "umd"], // add "umd" here
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: [], // list external deps here if any
      output: {
        exports: "named", // 👈 suppress warning about mixed exports
      },
    },
    outDir: "dist",
  },
  plugins: [
    dts({ outputDir: "dist", insertTypesEntry: true, rollupTypes: true }),
  ],
});
