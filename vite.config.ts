import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
	base: './',
	root: 'src',
	plugins: [
		viteSingleFile(),
		viteStaticCopy({
			targets: [
				{
					src: '../node_modules/stockfish/src/stockfish-17.1-8e4d048.js',
					dest: 'stockfish'
				},
				{
					src: '../node_modules/stockfish/src/stockfish-17.1-8e4d048-part-*.wasm',
					dest: 'stockfish'
				},
				{
					src: '../node_modules/coi-serviceworker/coi-serviceworker.js',
					dest: '.'
				}
			]
		})
	],
	build: {
		target: 'esnext',
		cssCodeSplit: false,
		outDir: '../dist',
		emptyOutDir: true,
		minify: false
	},
	server: {
		// Without these, WASM multi-threading fails with a console error like "SharedArrayBuffer is not defined".
		// EDIT: The 'server' section below is redundant because we use coi-serviceworker.js
		// to support GitHub Pages. However, we keep it here as it is the standard way to
		// enable SharedArrayBuffer on platforms that support custom headers.
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
	}
});
