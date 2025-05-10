'use client';

import { useState, useEffect, useRef } from 'react';
import { Press_Start_2P } from 'next/font/google';
import Head from 'next/head';

const pressStart2P = Press_Start_2P({ weight: '400', subsets: ['latin'] });

const ROWS = 10;
const COLS = 10;
const MINES = 10;
const TREASURES = [
  { type: 'gold', points: 500, emoji: '💰', count: 3 },
  { type: 'silver', points: 250, emoji: '🕋', count: 4 },
  { type: 'gem', points: 1000, emoji: '💎', count: 2 },
  { type: 'money', points: 100, emoji: '💵', count: 5 },
];

type CellValue = number | 'mine' | 'gold' | 'silver' | 'gem' | 'money';

type Player = {
  walletAddress: string;
  assetAddress: string;
  xp: number;
};

export default function Home() {
  const [board, setBoard] = useState<CellValue[][]>([]);
  const [revealed, setRevealed] = useState<boolean[][]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [gameStatus, setGameStatus] = useState('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [assetAddress, setAssetAddress] = useState('');
  const [xp, setXp] = useState(0);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'game' | 'leaderboard'>('game');

  // Audio refs
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const explosionAudioRef = useRef<HTMLAudioElement | null>(null);
  const gameOverAudioRef = useRef<HTMLAudioElement | null>(null);
  const treasureAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio on component mount
  useEffect(() => {
    try {
      // Create audio elements
      backgroundAudioRef.current = new Audio('/sounds/background.mp3');
      explosionAudioRef.current = new Audio('/sounds/explosion.mp3');
      gameOverAudioRef.current = new Audio('/sounds/game-over.mp3');
      treasureAudioRef.current = new Audio('/sounds/treasure.mp3');

      // Configure background audio
      if (backgroundAudioRef.current) {
        backgroundAudioRef.current.loop = true;
        backgroundAudioRef.current.volume = 0.3;
      }

      // Preload all audio files
      const audioFiles = [
        backgroundAudioRef.current,
        explosionAudioRef.current,
        gameOverAudioRef.current,
        treasureAudioRef.current
      ];

      audioFiles.forEach(audio => {
        if (audio) {
          audio.load();
        }
      });
    } catch (error) {
      console.error('Error initializing audio:', error);
    }

    // Cleanup on unmount
    return () => {
      const audioFiles = [
        backgroundAudioRef.current,
        explosionAudioRef.current,
        gameOverAudioRef.current,
        treasureAudioRef.current
      ];

      audioFiles.forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    };
  }, []);

  // Play background sound when game starts, pause on game over
  useEffect(() => {
    const playBackgroundMusic = async () => {
      if (!gameOver && backgroundAudioRef.current) {
        try {
          await backgroundAudioRef.current.play();
        } catch (error) {
          console.error('Error playing background music:', error);
        }
      } else if (gameOver && backgroundAudioRef.current) {
        backgroundAudioRef.current.pause();
      }
    };

    playBackgroundMusic();
  }, [gameOver]);

  const initializeBoard = () => {
    const newBoard = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
    const newRevealed = Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(false));

    // Place mines
    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * COLS);
      if (newBoard[row][col] === 0) {
        newBoard[row][col] = 'mine';
        minesPlaced++;
      }
    }

    // Place treasures
    TREASURES.forEach((treasure) => {
      let placed = 0;
      while (placed < treasure.count) {
        const row = Math.floor(Math.random() * ROWS);
        const col = Math.floor(Math.random() * COLS);
        if (newBoard[row][col] === 0) {
          newBoard[row][col] = treasure.type;
          placed++;
        }
      }
    });

    // Calculate numbers
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (
          newBoard[r][c] === 'mine' ||
          newBoard[r][c] === 'gold' ||
          newBoard[r][c] === 'silver' ||
          newBoard[r][c] === 'gem' ||
          newBoard[r][c] === 'money'
        )
          continue;
        newBoard[r][c] = countAdjacentMines(newBoard, r, c);
      }
    }

    setBoard(newBoard);
    setRevealed(newRevealed);
    setScore(0);
    setLives(3);
    setGameOver(false);
    setGameStatus('');
  };

  const countAdjacentMines = (board: CellValue[][], row: number, col: number) => {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === 'mine') {
          count++;
        }
      }
    }
    return count;
  };

  const revealCell = (row: number, col: number) => {
    if (gameOver || revealed[row][col]) return;

    const newRevealed = [...revealed.map((r) => [...r])];
    const cellsToReveal: [number, number][] = [[row, col]];
    let newScore = score;

    while (cellsToReveal.length > 0) {
      const [r, c] = cellsToReveal.pop()!;
      if (newRevealed[r][c]) continue;
      newRevealed[r][c] = true;

      if (board[r][c] === 'mine') {
        // Play explosion sound
        explosionAudioRef.current?.play().catch((e) => console.error('Explosion audio error:', e));
        newScore = Math.max(0, newScore - 1000);
        setLives((prev) => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setGameOver(true);
            setGameStatus('Game Over!');
            // Play game over sound
            gameOverAudioRef.current?.play().catch((e) => console.error('Game over audio error:', e));
            revealAllMines(newRevealed);
          }
          return newLives;
        });
      } else if (
        board[r][c] === 'gold' ||
        board[r][c] === 'silver' ||
        board[r][c] === 'gem' ||
        board[r][c] === 'money'
      ) {
        // Play treasure sound
        treasureAudioRef.current?.play().catch((e) => console.error('Treasure audio error:', e));
        const treasure = TREASURES.find((t) => t.type === board[r][c]);
        if (treasure) {
          newScore += treasure.points;
        }
      } else {
        newScore += 20;
        if (board[r][c] === 0) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !newRevealed[nr][nc]) {
                cellsToReveal.push([nr, nc]);
              }
            }
          }
        }
      }
    }

    setScore(newScore);
    setRevealed(newRevealed);

    if (!gameOver && checkWin(newRevealed)) {
      setGameOver(true);
      setGameStatus('You Win!');
    }
  };

  const revealAllMines = (revealedState: boolean[][]) => {
    const newRevealed = [...revealedState.map((r) => [...r])];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === 'mine' && !newRevealed[r][c]) {
          newRevealed[r][c] = true;
        }
      }
    }
    setRevealed(newRevealed);
  };

  const checkWin = (revealedState: boolean[][]) => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] !== 'mine' && !revealedState[r][c]) {
          return false;
        }
      }
    }
    return true;
  };

  // Mock function to connect wallet (replace with actual wallet connection logic)
  const connectWallet = async () => {
    try {
      // Replace this with actual wallet connection logic
      const mockAddress = '0x' + Math.random().toString(16).slice(2, 42);
      setWalletAddress(mockAddress);
      setAssetAddress('0x' + Math.random().toString(16).slice(2, 42));
      setIsWalletConnected(true);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  // Mock function to claim points (replace with actual claim logic)
  const claimPoints = async () => {
    try {
      // Replace this with actual claim logic
      setXp(prev => prev + score);
      setShowClaimModal(false);
    } catch (error) {
      console.error('Error claiming points:', error);
    }
  };

  // Mock function to fetch leaderboard (replace with actual API call)
  useEffect(() => {
    const mockLeaderboard: Player[] = Array.from({ length: 10 }, (_, i) => ({
      walletAddress: '0x' + Math.random().toString(16).slice(2, 42),
      assetAddress: '0x' + Math.random().toString(16).slice(2, 42),
      xp: Math.floor(Math.random() * 10000)
    })).sort((a, b) => b.xp - a.xp);
    setLeaderboard(mockLeaderboard);
  }, []);

  // Show claim modal when game is over
  useEffect(() => {
    if (gameOver && isWalletConnected) {
      setShowClaimModal(true);
    }
  }, [gameOver, isWalletConnected]);

  useEffect(() => {
    initializeBoard();
  }, []);

  return (
    <>
      <Head>
        <title>Minesweeper Arcade</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div
        className={`flex flex-col items-center justify-center min-h-screen bg-cover bg-center p-4 ${pressStart2P.className}`}
        style={{
          backgroundImage: "url('/images/bg.jpg')",
        }}
      >
        {/* Wallet Connection - Fixed Position */}
        <div className="fixed top-4 right-4 z-50">
          {!isWalletConnected ? (
            <button
              onClick={connectWallet}
              className="px-3 sm:px-4 py-2 bg-yellow-400 border-[3px] border-white text-xs sm:text-sm cursor-pointer hover:bg-yellow-600 transition-colors rounded-lg shadow-lg [text-shadow:2px_2px_#000]"
            >
              Connect Wallet
            </button>
          ) : (
            <div className="text-white text-xs sm:text-sm bg-black/70 p-2 rounded-lg border-2 border-yellow-400">
              <div>XP: {xp}</div>
              <div className="truncate max-w-[120px] sm:max-w-[150px]">
                {walletAddress}
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="w-full max-w-[95vw] sm:max-w-[500px] mb-4 flex flex-col items-center">
          <h1 className="text-2xl sm:text-3xl text-white mb-4 [text-shadow:2px_2px_#000] bg-black/70 px-6 py-2 rounded-lg border-2 border-yellow-400">
            Minesweeper
          </h1>
          <div className="w-full flex justify-center items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('game')}
                className={`px-4 py-2 border-[3px] border-white text-sm sm:text-base cursor-pointer transition-colors [text-shadow:2px_2px_#000] ${
                  activeTab === 'game'
                    ? 'bg-yellow-400 hover:bg-yellow-600'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                Play
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`px-4 py-2 border-[3px] border-white text-sm sm:text-base cursor-pointer transition-colors [text-shadow:2px_2px_#000] ${
                  activeTab === 'leaderboard'
                    ? 'bg-yellow-400 hover:bg-yellow-600'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                Leaderboard
              </button>
            </div>
          </div>
        </div>

        {/* Game Container */}
        {activeTab === 'game' && (
          <div className="text-center bg-black/70 p-3 sm:p-5 rounded-[10px] border-[3px] border-yellow-400 shadow-[0_0_20px_#ffd700] w-full max-w-[95vw] sm:max-w-[500px]">
            <div className="mb-3 sm:mb-5 text-sm sm:text-lg text-white [text-shadow:2px_2px_#000]">
              <div>
                Score: <span>{score}</span>
              </div>
              <div>
                Lives: <span>{lives}</span>
              </div>
              <div className={gameStatus === 'Game Over!' ? 'text-red-500 text-xl sm:text-2xl' : ''}>
                {gameStatus}
              </div>
            </div>
            <div className="inline-block border-[3px] border-white bg-[#333] overflow-x-auto max-w-full">
              {board.map((row, r) => (
                <div key={r} className="flex">
                  {row.map((cell, c) => {
                    const isRevealed = revealed[r]?.[c];
                    const isMine = cell === 'mine';
                    const isTreasure = ['gold', 'silver', 'gem', 'money'].includes(cell as string);
                    const treasure = isTreasure ? TREASURES.find((t) => t.type === cell) : null;
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border-2 border-[#777] text-white text-sm sm:text-base cursor-pointer transition-colors select-none touch-none
                          ${isRevealed ? 'bg-[#222] cursor-default' : 'bg-[#555]'}
                          ${isRevealed && isMine ? 'bg-red-500' : ''}
                          ${isRevealed && isTreasure ? 'bg-yellow-400' : ''}`}
                        onClick={() => revealCell(r, c)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          revealCell(r, c);
                        }}
                      >
                        {isRevealed && isMine && '💣'}
                        {isRevealed && isTreasure && treasure?.emoji}
                        {isRevealed && !isMine && !isTreasure && typeof cell === 'number' && cell > 0 && cell}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <button
              className={`mt-3 sm:mt-5 px-4 sm:px-5 py-2 bg-yellow-400 border-[3px] border-white text-sm sm:text-base cursor-pointer hover:bg-yellow-600 transition-colors [text-shadow:2px_2px_#000] ${
                gameOver ? 'block' : 'hidden'
              }`}
              onClick={initializeBoard}
            >
              Restart
            </button>
          </div>
        )}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="w-full max-w-[95vw] sm:max-w-[500px] bg-black/70 p-3 sm:p-5 rounded-[10px] border-[3px] border-yellow-400 shadow-[0_0_20px_#ffd700]">
            <h2 className="text-lg sm:text-xl text-white mb-3 [text-shadow:2px_2px_#000]">Top Players</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-white text-sm">
                <thead>
                  <tr className="border-b border-yellow-400">
                    <th className="p-2 text-left">Rank</th>
                    <th className="p-2 text-left">Wallet</th>
                    <th className="p-2 text-left">Asset</th>
                    <th className="p-2 text-right">XP</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((player, index) => (
                    <tr key={index} className="border-b border-gray-700">
                      <td className="p-2">#{index + 1}</td>
                      <td className="p-2 truncate max-w-[100px] sm:max-w-[150px]">{player.walletAddress}</td>
                      <td className="p-2 truncate max-w-[100px] sm:max-w-[150px]">{player.assetAddress}</td>
                      <td className="p-2 text-right">{player.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Claim Modal */}
        {showClaimModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-black/90 p-5 rounded-[10px] border-[3px] border-yellow-400 shadow-[0_0_20px_#ffd700] max-w-[400px] w-full">
              <h2 className="text-xl text-white mb-4 [text-shadow:2px_2px_#000]">Claim Your Points!</h2>
              <p className="text-white mb-4">You've earned {score} points! Claim them to add to your XP.</p>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowClaimModal(false)}
                  className="px-4 py-2 bg-gray-600 border-[3px] border-white text-white cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={claimPoints}
                  className="px-4 py-2 bg-yellow-400 border-[3px] border-white cursor-pointer hover:bg-yellow-600 transition-colors [text-shadow:2px_2px_#000]"
                >
                  Claim Points
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}