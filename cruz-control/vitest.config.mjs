import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";;
import { fileURLToPath } from "node:url";

export default defineConfig({
    plugins: [react()],
    // Our components are .js files with JSX, which Vite only parses in .jsx files by default
    oxc: {
        include: /\.jsx?$/,
        exclude: /node_modules/,
        lang: "jsx",
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        }
    },
    test: {
        environment: "jsdom",
        globals: true,
        passWithNoTests: true
    }
})