// Web Worker-based engine; actual usage is via postMessage with strings.
export interface StockfishWorker extends Worker {
	postMessage: (message: string) => void;
	onmessage: ((event: MessageEvent<string>) => void) | null;
}

export type StockfishCommand =
	| 'uci'
	| 'isready'
	| 'ucinewgame'
	| 'quit'
	| { cmd: 'position'; fen: string }
	| { cmd: 'go'; movetime?: number; depth?: number }
	| { cmd: 'setoption'; name: string; value: string | number };