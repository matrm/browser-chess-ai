// src/stockfish/Engine.ts
import type { StockfishWorker, StockfishCommand } from '../types/stockfish';

export class ChessEngine {
	private worker: StockfishWorker | null = null;
	private readonly workerPath = 'stockfish/stockfish-17.1-8e4d048.js';

	public onBestMove: ((move: string) => void) | null = null;

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.worker = new Worker(this.workerPath) as StockfishWorker;

			this.worker.onmessage = (event: MessageEvent<string>) => {
				const data = event.data;
				console.log('Stockfish:', data);// Uncomment for debugging

				if (data === 'readyok') {
					resolve();
				} else if (data.startsWith('bestmove')) {
					const parts = data.split(' ');
					const move = parts[1];// UCI format: "bestmove d7d5 ponder c2c4"
					if (this.onBestMove && move && move !== '(none)') {
						this.onBestMove(move);
					}
				}
			};

			this.worker.onerror = reject;

			// Send init command
			this.worker.postMessage('uci');
			this.worker.postMessage('isready');
		});
	}

	postCommand(cmd: StockfishCommand): void {
		if (!this.worker) throw new Error('Engine not initialized');

		let message: string;
		if (typeof cmd === 'string') {
			message = cmd;
		} else {
			if (cmd.cmd === 'position') {
				message = `position fen ${cmd.fen}`;
			} else if (cmd.cmd === 'go') {
				message = 'go';
				if (cmd.depth) message += ` depth ${cmd.depth}`;
				if (cmd.movetime) message += ` movetime ${cmd.movetime}`;
			} else if (cmd.cmd === 'setoption') {
				message = `setoption name ${cmd.name} value ${cmd.value}`;
			} else {
				return;
			}
		}
		this.worker.postMessage(message);
	}

	search(options: { depth?: number; movetime?: number }): void {
		this.postCommand({ cmd: 'go', ...options });
	}

	newGame(): void {
		this.postCommand('ucinewgame');
	}

	setPosition(fen: string): void {
		this.postCommand({ cmd: 'position', fen });
	}
}