import { Chess, Square, Move } from 'chess.js';
import { ChessEngine } from './stockfish/Engine';

/**
 * DOM Elements
 * References to HTML elements used in the application.
 */
const elements = {
	board: document.getElementById('board') as HTMLDivElement,
	status: document.getElementById('status') as HTMLDivElement,
	difficultyInput: document.getElementById('difficulty') as HTMLInputElement,
	depthVal: document.getElementById('depth-val') as HTMLSpanElement,
	timeInput: document.getElementById('time-limit') as HTMLInputElement,
	timeVal: document.getElementById('time-val') as HTMLSpanElement,
	depthControl: document.getElementById('depth-control') as HTMLDivElement,
	timeControl: document.getElementById('time-control') as HTMLDivElement,
	aiModeRadios: document.querySelectorAll('input[name="ai-mode"]') as NodeListOf<HTMLInputElement>,
	undoBtn: document.getElementById('undo-btn') as HTMLButtonElement,
	rotateBtn: document.getElementById('rotate-btn') as HTMLButtonElement,
	playWhiteBtn: document.getElementById('play-white') as HTMLButtonElement,
	playBlackBtn: document.getElementById('play-black') as HTMLButtonElement,
	history: document.getElementById('history') as HTMLDivElement,
	modalContainer: document.getElementById('modal-container') as HTMLDivElement,
	modalTitle: document.getElementById('modal-title') as HTMLHeadingElement,
	modalMessage: document.getElementById('modal-message') as HTMLParagraphElement,
	modalConfirm: document.getElementById('modal-confirm') as HTMLButtonElement,
	modalCancel: document.getElementById('modal-cancel') as HTMLButtonElement,
};

/**
 * Game State
 * Variables to track the current state of the game and AI.
 */
const game = new Chess();
const engine = new ChessEngine();

let gameState = {
	playerColor: 'w' as 'w' | 'b',
	aiMode: 'depth' as 'depth' | 'time',
	aiDepth: parseInt(elements.difficultyInput.value, 10),
	aiTime: parseInt(elements.timeInput.value, 10),
	selectedSquare: null as Square | null,
	possibleMoves: [] as Move[],
	isAiThinking: false,
	aiStartTime: 0,
	isBoardRotated: false,
};

/**
 * Constants
 * Mapping of piece codes to unicode characters.
 */
const PIECES: Record<string, string> = {
	'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚',
	'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔'
};

/**
 * Initialization
 * Sets up the engine and initial render.
 */
async function init() {
	try {
		await engine.init();
		console.log('Stockfish initialized');

		// Configure engine options
		// const threads = Math.max(1, (navigator.hardwareConcurrency || 2) - 1);// Causes access violation crashes when using many threads.
		const threads = Math.max(1, (navigator.hardwareConcurrency || 1) / 5);
		// The number of CPU threads used for searching a position https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html#threads
		engine.postCommand({ cmd: 'setoption', name: 'Threads', value: threads });

		const hash = threads * 64;
		// Hash table size (in MB) https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html#hash
		engine.postCommand({ cmd: 'setoption', name: 'Hash', value: hash });
		console.log(`Configured Stockfish with ${threads} threads and ${hash}MB hash`);

		// Handle engine responses
		engine.onBestMove = (moveStr) => {
			const elapsed = Date.now() - gameState.aiStartTime;
			console.log(`AI Best Move: ${moveStr} (took ${elapsed}ms)`);
			gameState.isAiThinking = false;

			// Parse UCI move (e.g., "e2e4")
			const from = moveStr.substring(0, 2);
			const to = moveStr.substring(2, 4);
			const promotion = moveStr.length > 4 ? moveStr.substring(4, 5) : undefined;

			try {
				game.move({ from, to, promotion });
				updateUI();
			} catch (e) {
				console.error('Invalid AI move:', moveStr, e);
			}
		};

		updateUI();
	} catch (e) {
		console.error('Engine failed:', e);
		elements.status.textContent = 'Error loading engine';
	}
}

/**
 * UI Updates
 * Central function to update all UI components.
 */
function updateUI() {
	renderBoard();
	renderHistory();
	updateStatus();
}

/**
 * Render Board
 * Draws the chess board and pieces based on current game state.
 */
function renderBoard() {
	// Use a fragment to avoid multiple layout reflows
	const fragment = document.createDocumentFragment();

	// Determine board orientation
	// Default: White at bottom. If playing Black, Black at bottom.
	// Rotation toggles this.
	const isFlipped = gameState.isBoardRotated ? (gameState.playerColor === 'w') : (gameState.playerColor === 'b');

	const history = game.history({ verbose: true });
	const lastMove = history.length > 0 ? history[history.length - 1] : null;

	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			const row = isFlipped ? 7 - r : r;
			const col = isFlipped ? 7 - c : c;

			const square = String.fromCharCode(97 + col) + (8 - row) as Square;
			const piece = game.get(square);
			const isLight = (row + col) % 2 === 0;

			// Add labels to the first column (rank) and last row (file)
			const rankLabel = c === 0 ? String(8 - row) : undefined;
			const fileLabel = r === 7 ? String.fromCharCode(97 + col) : undefined;

			const squareEl = createSquareElement(square, isLight, piece, lastMove, rankLabel, fileLabel);
			fragment.appendChild(squareEl);
		}
	}

	elements.board.innerHTML = '';
	elements.board.appendChild(fragment);
}

/**
 * Create Square Element
 * Helper to create individual square DOM elements.
 */
function createSquareElement(square: Square, isLight: boolean, piece: any, lastMove: any, rankLabel?: string, fileLabel?: string) {
	const squareEl = document.createElement('div');
	squareEl.className = `square ${isLight ? 'light' : 'dark'}`;
	squareEl.dataset.square = square;

	// Add rank label (numbers 1-8)
	if (rankLabel) {
		const rankEl = document.createElement('div');
		rankEl.className = 'rank-label';
		rankEl.textContent = rankLabel;
		squareEl.appendChild(rankEl);
	}

	// Add file label (letters a-h)
	if (fileLabel) {
		const fileEl = document.createElement('div');
		fileEl.className = 'file-label';
		fileEl.textContent = fileLabel;
		squareEl.appendChild(fileEl);
	}

	// Highlight selected square
	if (gameState.selectedSquare === square) {
		squareEl.classList.add('selected');
	}

	// Highlight last move
	if (lastMove && (lastMove.from === square || lastMove.to === square)) {
		squareEl.classList.add('last-move');
	}

	// Highlight possible moves or handle selection
	const move = gameState.possibleMoves.find(m => m.to === square);
	if (move) {
		squareEl.classList.add('possible-move');
		squareEl.onclick = () => handleMove(move);
	} else {
		squareEl.onclick = () => handleSquareClick(square);
	}

	// Render piece if present
	if (piece) {
		const span = document.createElement('span');
		const char = PIECES[piece.color === 'w' ? piece.type.toUpperCase() : piece.type];
		span.textContent = char;

		// Apply color classes for styling (shadows, etc.)
		span.className = piece.color === 'w' ? 'piece-white' : 'piece-black';

		squareEl.appendChild(span);
	}

	// Highlight check
	if (game.inCheck() && piece && piece.type === 'k' && piece.color === game.turn()) {
		squareEl.classList.add('check');
	}

	return squareEl;
}

/**
 * Update Status Text
 * Displays current game status (turn, checkmate, etc.).
 */
function updateStatus() {
	if (game.isGameOver()) {
		if (game.isCheckmate()) {
			elements.status.textContent = `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`;
		} else if (game.isDraw()) {
			elements.status.textContent = 'Draw!';
		} else {
			elements.status.textContent = 'Game Over';
		}
		return;
	}

	if (gameState.isAiThinking) {
		elements.status.textContent = 'AI is thinking...';
	} else {
		elements.status.textContent = game.turn() === gameState.playerColor ? 'Your Turn' : 'AI Turn';
	}
}

/**
 * Render History
 * Displays the list of moves made in the game.
 */
function renderHistory() {
	const fragment = document.createDocumentFragment();
	const history = game.history({ verbose: true });

	history.forEach((move, index) => {
		const moveEl = document.createElement('div');
		moveEl.className = `history-move ${index % 2 === 0 ? 'white' : 'black'}`;

		const moveNumber = Math.floor(index / 2) + 1;
		const pieceKey = move.color === 'w' ? move.piece.toUpperCase() : move.piece;
		const pieceIcon = PIECES[pieceKey];

		// Handle captures
		let captureHtml = '';
		if (move.captured) {
			const capturedKey = move.color === 'w' ? move.captured : move.captured.toUpperCase();
			const capturedIcon = PIECES[capturedKey];
			captureHtml = `<span class="move-piece move-capture">${capturedIcon}</span>`;
		}

		moveEl.innerHTML = `<span class="move-number">${moveNumber}.</span><span class="move-piece ${move.color === 'w' ? 'piece-white' : 'piece-black'}">${pieceIcon}</span><span>${move.from} to ${move.to}</span>${captureHtml}`;

		fragment.appendChild(moveEl);
	});

	elements.history.innerHTML = '';
	elements.history.appendChild(fragment);

	// Auto-scroll to bottom
	elements.history.scrollTop = elements.history.scrollHeight;
}

/**
 * Handle Square Click
 * Logic for selecting pieces and initiating moves.
 */
function handleSquareClick(square: Square) {
	// Prevent interaction if AI is thinking or game is over
	if (gameState.isAiThinking || game.isGameOver()) return;
	// Prevent interaction if it's not player's turn
	if (game.turn() !== gameState.playerColor) return;

	const piece = game.get(square);

	// Select own piece
	if (piece && piece.color === gameState.playerColor) {
		if (gameState.selectedSquare === square) {
			// Deselect if clicking same piece
			gameState.selectedSquare = null;
			gameState.possibleMoves = [];
		} else {
			// Select new piece
			gameState.selectedSquare = square;
			gameState.possibleMoves = game.moves({ square, verbose: true }) as Move[];
		}
		renderBoard();
	} else if (gameState.selectedSquare) {
		// Clicking empty square or enemy piece (invalid move) -> Deselect
		gameState.selectedSquare = null;
		gameState.possibleMoves = [];
		renderBoard();
	}
}

/**
 * Handle Move
 * Executes a move chosen by the player.
 */
function handleMove(move: Move) {
	game.move(move);
	gameState.selectedSquare = null;
	gameState.possibleMoves = [];

	updateUI();

	// Trigger AI turn if game is not over
	if (!game.isGameOver()) {
		makeAiMove();
	}
}

/**
 * Make AI Move
 * Initiates the AI thinking process.
 */
async function makeAiMove() {
	gameState.isAiThinking = true;
	updateStatus();

	// Small delay to allow UI to update before blocking with calculation (if synchronous)
	// Note: Stockfish runs in a worker, so it won't block main thread, but this gives visual feedback.
	setTimeout(() => {
		engine.setPosition(game.fen());

		gameState.aiStartTime = Date.now();
		if (gameState.aiMode === 'depth') {
			engine.search({ depth: gameState.aiDepth });
		} else {
			engine.search({ movetime: gameState.aiTime });
		}
	}, 100);
}

/**
 * Start New Game
 * Resets the game state.
 */
function startNewGame() {
	game.reset();
	engine.newGame();
	gameState.selectedSquare = null;
	gameState.possibleMoves = [];
	gameState.isAiThinking = false;

	// If playing Black, AI moves first
	if (gameState.playerColor === 'b') {
		makeAiMove();
	}
	updateUI();
}

/**
 * Show Custom Modal
 * Replaces the native confirm() with a non-blocking beautiful modal.
 */
function showModal(title: string, message: string): Promise<boolean> {
	return new Promise((resolve) => {
		elements.modalTitle.textContent = title;
		elements.modalMessage.textContent = message;
		elements.modalContainer.classList.add('active');

		const cleanup = (result: boolean) => {
			elements.modalContainer.classList.remove('active');
			elements.modalConfirm.onclick = null;
			elements.modalCancel.onclick = null;
			elements.modalContainer.onclick = null;
			resolve(result);
		};

		elements.modalConfirm.onclick = () => cleanup(true);
		elements.modalCancel.onclick = () => cleanup(false);
		// Also allow closing by clicking outside
		elements.modalContainer.onclick = (e) => {
			if (e.target === elements.modalContainer) cleanup(false);
		};
	});
}

// --- Event Listeners ---

// AI Mode Selection
elements.aiModeRadios.forEach(radio => {
	radio.addEventListener('change', (e) => {
		gameState.aiMode = (e.target as HTMLInputElement).value as 'depth' | 'time';
		if (gameState.aiMode === 'depth') {
			elements.depthControl.style.display = 'block';
			elements.timeControl.style.display = 'none';
		} else {
			elements.depthControl.style.display = 'none';
			elements.timeControl.style.display = 'block';
		}
	});
});

// Difficulty / Time Controls
elements.difficultyInput.addEventListener('input', (e) => {
	gameState.aiDepth = parseInt((e.target as HTMLInputElement).value);
	elements.depthVal.textContent = gameState.aiDepth.toString();
});

elements.timeInput.addEventListener('input', (e) => {
	gameState.aiTime = parseInt((e.target as HTMLInputElement).value);
	elements.timeVal.textContent = gameState.aiTime.toString();
});

// Play as White
elements.playWhiteBtn.addEventListener('click', async () => {
	if (game.history().length > 0) {
		const confirmed = await showModal('New Game', 'Start a new game as White? Current progress will be lost.');
		if (!confirmed) return;
	}

	gameState.playerColor = 'w';
	updatePlayerButtonStyles();
	startNewGame();
});

// Play as Black
elements.playBlackBtn.addEventListener('click', async () => {
	if (game.history().length > 0) {
		const confirmed = await showModal('New Game', 'Start a new game as Black? Current progress will be lost.');
		if (!confirmed) return;
	}

	gameState.playerColor = 'b';
	updatePlayerButtonStyles();
	startNewGame();
});

function updatePlayerButtonStyles() {
	const isWhite = gameState.playerColor === 'w';
	elements.playWhiteBtn.style.background = isWhite ? '#eee' : '#333';
	elements.playWhiteBtn.style.color = isWhite ? '#333' : '#eee';
	elements.playBlackBtn.style.background = isWhite ? '#333' : '#eee';
	elements.playBlackBtn.style.color = isWhite ? '#eee' : '#333';
}

// Undo Button
elements.undoBtn.addEventListener('click', () => {
	if (gameState.isAiThinking) return;

	// Undo last move
	game.undo();

	// If it was AI's turn, undo again to return to player's turn
	if (game.turn() !== gameState.playerColor && game.history().length > 0) {
		game.undo();
	}

	gameState.selectedSquare = null;
	gameState.possibleMoves = [];
	updateUI();

	// Trigger AI turn if it's now AI's turn (e.g. undoing back to start as Black)
	if (game.turn() !== gameState.playerColor && !game.isGameOver()) {
		makeAiMove();
	}
});

// Rotate Board Button
elements.rotateBtn.addEventListener('click', () => {
	gameState.isBoardRotated = !gameState.isBoardRotated;
	renderBoard();
});

// Start the application
init();