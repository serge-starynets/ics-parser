import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	test: {
		globals: true,
	},
	plugins: [cloudflare()],
});