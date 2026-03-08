import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import Sonda from 'sonda/sveltekit'

export default defineConfig({
	build: {
		sourcemap: true, // enable production source maps
	},
	css: {
		devSourcemap: true, // enable CSS source maps during development
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		Sonda({
			server: true,
			gzip: true,
			format: 'json', // Set format to JSON
			outputDir: '.sonda', // Output directory
		}),
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
				},
			},
		],
	},
})
