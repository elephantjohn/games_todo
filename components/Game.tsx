"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import { RefreshCw, Hand } from "lucide-react";

// --- Config: More Fruits! ---
const FRUITS = [
  { id: 0, label: "Grape", radius: 24, color: "#9333EA", emoji: "🍇" }, 
  { id: 1, label: "Cherry", radius: 26, color: "#DC2626", emoji: "🍒" }, 
  { id: 2, label: "Orange", radius: 28, color: "#F97316", emoji: "🍊" }, 
  { id: 3, label: "Lemon", radius: 30, color: "#FACC15", emoji: "🍋" }, 
  { id: 4, label: "Raspberry", radius: 25, color: "#4F46E5", emoji: "🫐" }, 
  { id: 5, label: "Strawberry", radius: 27, color: "#E11D48", emoji: "🍓" }, 
  { id: 6, label: "Peach", radius: 32, color: "#F472B6", emoji: "🍑" }, 
  { id: 7, label: "Coconut", radius: 34, color: "#A8A29E", emoji: "🥥" }, // New Level 4
];

const DOCK_SIZE = 7;

// --- Witty Texts ---
const TEXTS = {
  block: ["压住了!", "太沉了!", "拔不动...", "先挪开上面的!", "别硬拽!"],
  match: ["舒服了~", "走你!", "Nice!", "咻~", "解压!"],
  full: ["没地儿了!", "要满员了!", "稳住!", "危险!", "想清楚再点!"],
  fail: ["芭比Q了...", "这就满了?", "没救了", "下次一定行"],
  win: ["太强了!", "清空!", "大神!", "独孤求败"],
  shuffle: ["洗牌!", "大力出奇迹!", "搅匀点!", "翻滚吧!"],
  undo: ["回退!", "悔棋!", "再给我次机会", "时光倒流"]
};

const getRandomText = (type: keyof typeof TEXTS) => {
  const list = TEXTS[type];
  return list[Math.floor(Math.random() * list.length)];
};

class AudioController {
  ctx: AudioContext | null = null;
  init() {
    if (typeof window !== 'undefined' && !this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  play(type: 'click' | 'match' | 'fail' | 'win' | 'block' | 'shuffle' | 'undo') {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    if (type === 'click') {
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(); osc.stop(t + 0.1);
    } else if (type === 'match') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.linearRampToValueAtTime(800, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.start(); osc.stop(t + 0.2);
    } else if (type === 'block') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.1);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.start(); osc.stop(t + 0.1);
    } else if (type === 'fail') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      osc.start(); osc.stop(t + 0.5);
    } else if (type === 'shuffle') {
      // Woosh sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.linearRampToValueAtTime(600, t + 0.3);
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      osc.start(); osc.stop(t + 0.3);
    } else if (type === 'undo') {
      // Pop sound
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.linearRampToValueAtTime(200, t + 0.1);
      gain.gain.setValueAtTime(0.1, t);
      osc.start(); osc.stop(t + 0.1);
    }
  }
}
const audio = new AudioController();

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Game State ---
  const [level, setLevel] = useState(1);
  const [dock, setDock] = useState<number[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [fruitCount, setFruitCount] = useState(0);
  const [hintPos, setHintPos] = useState<{x: number, y: number} | null>(null);
  const [lastActionTime, setLastActionTime] = useState(Date.now());
  const [isDanger, setIsDanger] = useState(false);
  
  // Popups State
  const [popups, setPopups] = useState<Array<{id: number, x: number, y: number, text: string, color: string}>>([]);
  const popupIdRef = useRef(0);

  const engineRef = useRef<Matter.Engine | null>(null);
  const renderLoopRef = useRef<number | null>(null);

  // --- Helper: Spawn Popup ---
  const spawnPopup = (x: number, y: number, text: string, color = "#475569") => {
    const id = popupIdRef.current++;
    setPopups(prev => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  // --- Logic: Hint System ---
  useEffect(() => {
    if (gameState !== 'playing') { setHintPos(null); return; }
    const checkHint = setInterval(() => {
      if (Date.now() - lastActionTime > 4000) {
         if (!engineRef.current) return;
         const bodies = Matter.Composite.allBodies(engineRef.current.world);
         let targetId = -1;
         if (dock.length > 0) {
            const counts: {[k:number]:number} = {};
            dock.forEach(id => counts[id] = (counts[id] || 0) + 1);
            const pairId = Object.keys(counts).find(id => counts[parseInt(id)] === 2);
            if (pairId) targetId = parseInt(pairId);
            else targetId = dock[dock.length-1];
         }
         const targetBody = bodies.find(b => {
            if (!b.label.startsWith('fruit-')) return false;
            const id = parseInt(b.label.split('-')[1]);
            return targetId === -1 ? true : id === targetId;
         });
         if (targetBody) setHintPos({ x: targetBody.position.x, y: targetBody.position.y });
      }
    }, 1000);
    return () => clearInterval(checkHint);
  }, [lastActionTime, dock, gameState]);

  // --- Logic: Level Setup ---
  const startLevel = useCallback((lvl: number) => {
    if (!engineRef.current) return;
    
    // Clear everything
    const world = engineRef.current.world;
    Matter.Composite.clear(world, false, true); // Keep static walls
    
    // Reset State
    setDock([]);
    setGameState('playing');
    setLastActionTime(Date.now());
    setHintPos(null);
    setPopups([]);

    // Config
    const fruitTypes = Math.min(3 + Math.floor((lvl - 1) / 2), FRUITS.length); 
    const totalTriplets = 6 + lvl * 3; 
    const totalFruits = totalTriplets * 3;

    setFruitCount(totalFruits);

    // Create Pool
    let pool: number[] = [];
    for (let i = 0; i < totalTriplets; i++) {
       const type = Math.floor(Math.random() * fruitTypes);
       pool.push(type, type, type);
    }
    pool.sort(() => Math.random() - 0.5);

    // Get Container Width Safely
    const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
    const safeWidth = Math.max(300, containerWidth);
    const Bodies = Matter.Bodies;
    
    // Force immediate spawn for first batch to avoid "empty screen" feeling
    // Then stagger the rest
    pool.forEach((typeId, i) => {
       const delay = i * 100; // Faster spawn (100ms)
       
       setTimeout(() => {
         const x = Math.random() * (width - 60) + 30;
         const y = -100;
         const fruit = FRUITS[typeId];
         const body = Bodies.circle(x, y, fruit.radius, {
           label: `fruit-${typeId}`,
           restitution: 0.5,
           friction: 0.05,
           // Remove frictionAir override
           render: { fillStyle: fruit.color }
         });
         Matter.Composite.add(engineRef.current!.world, body);
       }, i * 50); // Fast drop (50ms)
    });
    });
  }, []);

  // --- Logic: Tools ---
  const handleShuffle = () => {
    if (gameState !== 'playing' || !engineRef.current) return;
    const bodies = Matter.Composite.allBodies(engineRef.current.world);
    bodies.forEach(b => {
      if (!b.isStatic) {
        Matter.Body.applyForce(b, b.position, {
          x: (Math.random() - 0.5) * 0.2, // Strong stir
          y: (Math.random() - 0.5) * 0.2
        });
      }
    });
    audio.play('shuffle');
    spawnPopup(containerRef.current!.clientWidth/2, containerRef.current!.clientHeight/2, getRandomText('shuffle'), "#f59e0b");
  };

  const handleUndo = () => {
    if (gameState !== 'playing' || !engineRef.current || dock.length === 0) return;
    
    // Pop last 3 or all
    const countToRemove = Math.min(3, dock.length);
    const removedIds = dock.slice(-countToRemove); // Get last N
    const newDock = dock.slice(0, -countToRemove); // Remaining
    setDock(newDock);
    
    // Respawn them at top
    const width = containerRef.current?.clientWidth || 300;
    const Bodies = Matter.Bodies;
    
    removedIds.forEach((typeId, i) => {
       const fruit = FRUITS[typeId];
       const body = Bodies.circle(Math.random() * (width - 60) + 30, -50 - (i*50), fruit.radius, {
         label: `fruit-${typeId}`,
         restitution: 0.5,
         friction: 0.05,
         frictionAir: 0.05,
         render: { fillStyle: fruit.color }
       });
       Matter.Composite.add(engineRef.current!.world, body);
       setFruitCount(c => c + 1);
    });
    
    audio.play('undo');
    spawnPopup(containerRef.current!.clientWidth/2, containerRef.current!.clientHeight - 200, getRandomText('undo'), "#3b82f6");
  };

  // --- Logic: Click ---
  const handleClick = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || !engineRef.current || !containerRef.current) return;
    setLastActionTime(Date.now());
    setHintPos(null);

    const bodies = Matter.Composite.allBodies(engineRef.current.world);
    let closestBody: Matter.Body | null = null;
    let minDist = Infinity;
    
    bodies.forEach(b => {
      if (b.label.startsWith('fruit-')) {
         const dx = b.position.x - clientX;
         const dy = b.position.y - clientY;
         const dist = dx*dx + dy*dy;
         if (dist < 3600 && dist < minDist) { // 60px radius forgiveness
            minDist = dist;
            closestBody = b;
         }
      }
    });
    
    if (closestBody) {
       const clickedFruit = closestBody as Matter.Body;
       
       // CHECK OBSTRUCTION
       const isBlocked = bodies.some(b => {
          if (b === clickedFruit || b.isStatic) return false;
          const dx = Math.abs(b.position.x - clickedFruit.position.x);
          const dy = clickedFruit.position.y - b.position.y;
          // Stricter check: must be truly on top
          return dy > 0 && dy < 50 && dx < 25; 
       });

       if (isBlocked) {
          audio.play('block');
          spawnPopup(clientX, clientY, getRandomText('block'), "#94a3b8"); // Slate-400
          Matter.Body.setVelocity(clickedFruit, { x: (Math.random()-0.5)*5, y: 0 }); // Shake
          return;
       }

       const typeId = parseInt(clickedFruit.label.split('-')[1]);
       
       if (dock.length < DOCK_SIZE) {
          const newDock = [...dock, typeId];
          setDock(newDock);
          audio.play('click');
          Matter.Composite.remove(engineRef.current.world, clickedFruit);
          setFruitCount(prev => prev - 1);
          checkMatch(newDock, clientX, clientY); // Pass coord for popup
          
          if (newDock.length === DOCK_SIZE - 1) {
             spawnPopup(containerRef.current.clientWidth/2, containerRef.current.clientHeight - 150, getRandomText('full'), "#ef4444");
          }
       } else {
         audio.play('fail');
         spawnPopup(clientX, clientY, "满了!", "#ef4444");
       }
    }
  }, [dock, gameState]);

  const checkMatch = (currentDock: number[], x: number, y: number) => {
    const counts: {[key: number]: number} = {};
    currentDock.forEach(id => counts[id] = (counts[id] || 0) + 1);
    
    let matchFound = false;
    let newDock = [...currentDock];
    
    for (const [idStr, count] of Object.entries(counts)) {
      if (count >= 3) {
        const id = parseInt(idStr);
        let removed = 0;
        newDock = newDock.filter(item => {
          if (item === id && removed < 3) { removed++; return false; }
          return true;
        });
        matchFound = true;
        audio.play('match');
        spawnPopup(x, y, getRandomText('match'), "#10b981"); // Green
        break;
      }
    }

    if (matchFound) {
      setDock(newDock);
    } else {
      setDock(newDock);
      if (newDock.length >= DOCK_SIZE) {
        setGameState('lost');
        audio.play('fail');
        spawnPopup(containerRef.current!.clientWidth/2, containerRef.current!.clientHeight/2, getRandomText('fail'), "#ef4444");
      }
    }
  };
  
  useEffect(() => {
    if (gameState === 'playing' && fruitCount === 0 && dock.length === 0) {
      setGameState('won');
      audio.play('win');
    }
  }, [fruitCount, dock, gameState]);

  // --- Physics & Render ---
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const Engine = Matter.Engine,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite;

    const engine = Engine.create();
    engine.gravity.y = 1; // Normal gravity
    engine.timing.timeScale = 1; // Normal speed
    engineRef.current = engine;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    
    canvasRef.current.width = width * dpr;
    canvasRef.current.height = height * dpr;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const wallThickness = 50;
    const ground = Bodies.rectangle(width / 2, height + wallThickness / 2 - 140, width, wallThickness, { isStatic: true });
    const leftWall = Bodies.rectangle(0 - wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
    const rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
    Composite.add(engine.world, [ground, leftWall, rightWall]);

    startLevel(1);

    const render = () => {
      if (!ctx || !canvasRef.current) return;
      ctx.clearRect(0, 0, width, height);

      const dangerY = 150;
      let danger = false;

      const bodies = Composite.allBodies(engine.world);
      bodies.forEach(body => {
        if (body.label.startsWith('fruit-')) {
          const index = parseInt(body.label.split('-')[1]);
          const fruit = FRUITS[index];
          if (body.position.y < dangerY) danger = true;

          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          
          ctx.beginPath();
          ctx.arc(0, 0, fruit.radius, 0, Math.PI * 2);
          ctx.fillStyle = fruit.color;
          ctx.fill();
          
          if (dock.includes(index)) {
             ctx.strokeStyle = "#FFF";
             ctx.lineWidth = 3;
             ctx.stroke();
          } else {
             ctx.strokeStyle = "rgba(0,0,0,0.1)";
             ctx.lineWidth = 1;
             ctx.stroke();
          }
          
          ctx.font = `${fruit.radius * 1.2}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#000";
          ctx.fillText(fruit.emoji, 0, 4);
          ctx.restore();
        }
      });
      
      setIsDanger(danger);
      if (danger) {
         ctx.save();
         ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
         ctx.setLineDash([5, 5]);
         ctx.lineWidth = 2;
         ctx.beginPath(); ctx.moveTo(0, dangerY); ctx.lineTo(width, dangerY); ctx.stroke();
         ctx.restore();
      }

      renderLoopRef.current = requestAnimationFrame(render);
    };
    renderLoopRef.current = requestAnimationFrame(render);

    const runner = Runner.create();
    Runner.run(runner, engine);

    return () => {
      if (renderLoopRef.current) cancelAnimationFrame(renderLoopRef.current);
      Runner.stop(runner);
      Engine.clear(engine);
    };
  }, [dock]);

  return (
    <div className={`relative w-full h-[100dvh] flex flex-col overflow-hidden touch-none select-none font-sans transition-colors duration-500 ${isDanger ? 'bg-orange-50' : 'bg-slate-50'}`}>
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center z-10 bg-white/60 backdrop-blur-sm border-b border-slate-200">
         <div className="font-black text-slate-700 text-xl tracking-tight">第 {level} 关</div>
         <div className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
           剩余 {fruitCount}
         </div>
         <button onClick={() => startLevel(level)} className="p-2 bg-white rounded-full shadow-sm hover:rotate-180 transition-all">
           <RefreshCw size={20} className="text-slate-600"/>
         </button>
      </div>

      {/* Game Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full cursor-pointer relative"
        onMouseDown={e => {
           const rect = containerRef.current!.getBoundingClientRect();
           handleClick(e.clientX - rect.left, e.clientY - rect.top);
        }}
        onTouchStart={e => {
           const rect = containerRef.current!.getBoundingClientRect();
           handleClick(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
        }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
        
        {/* Popups Layer */}
        {popups.map(p => (
           <div 
             key={p.id}
             className="absolute font-bold text-lg pointer-events-none animate-bounce-short whitespace-nowrap"
             style={{ left: p.x, top: p.y, color: p.color, transform: 'translate(-50%, -100%)' }}
           >
             {p.text}
           </div>
        ))}

        {hintPos && (
           <div className="absolute pointer-events-none text-4xl animate-bounce z-20 drop-shadow-md" 
                style={{ left: hintPos.x - 20, top: hintPos.y - 60 }}>
             👇
           </div>
        )}
        
        {isDanger && (
           <div className="absolute top-4 left-0 right-0 text-center animate-pulse z-0 pointer-events-none">
              <span className="text-red-400 font-bold text-6xl opacity-10">DANGER</span>
           </div>
        )}
      </div>

      {/* DOCK */}
      <div className="h-44 bg-white border-t-4 border-slate-200 flex flex-col items-center justify-end relative z-30 shadow-2xl pb-safe">
         
         {/* Tools Bar */}
         <div className="flex gap-8 mb-2 w-full justify-center">
            <button 
              onClick={handleShuffle}
              className="flex flex-col items-center text-slate-500 active:scale-90 transition-transform"
            >
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mb-1">
                <span className="text-xl">🌪️</span>
              </div>
              <span className="text-[10px] font-bold">洗牌</span>
            </button>
            <button 
              onClick={handleUndo}
              disabled={dock.length === 0}
              className={`flex flex-col items-center active:scale-90 transition-transform ${dock.length === 0 ? 'opacity-30' : 'text-slate-500'}`}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-1">
                <span className="text-xl">🔙</span>
              </div>
              <span className="text-[10px] font-bold">移出</span>
            </button>
         </div>

         <div className="flex gap-2 p-3 bg-slate-100 rounded-2xl border-inner shadow-inner ring-4 ring-white mb-2">
            {Array.from({ length: DOCK_SIZE }).map((_, i) => {
               const fruitId = dock[i];
               const fruit = fruitId !== undefined ? FRUITS[fruitId] : null;
               return (
                 <div key={i} className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center border-2 border-slate-200 relative shadow-sm">
                    {fruit && <span className="text-2xl md:text-3xl animate-pop-in">{fruit.emoji}</span>}
                 </div>
               );
            })}
         </div>
         
         {/* End Screens */}
         {gameState === 'lost' && (
           <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white animate-in slide-in-from-bottom z-50">
              <div className="text-6xl mb-4">😭</div>
              <div className="text-3xl font-black mb-2">{getRandomText('fail')}</div>
              <button onClick={() => startLevel(level)} className="mt-4 bg-white text-slate-900 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all">不服，再来！</button>
           </div>
         )}
         {gameState === 'won' && (
           <div className="absolute inset-0 bg-emerald-500/95 flex flex-col items-center justify-center text-white animate-in slide-in-from-bottom z-50">
              <div className="text-6xl mb-4 animate-spin-slow">🎉</div>
              <div className="text-3xl font-black mb-2">{getRandomText('win')}</div>
              <button onClick={() => startLevel(level + 1)} className="mt-4 bg-white text-emerald-600 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 active:scale-95 transition-all">下一关</button>
           </div>
         )}
      </div>

    </div>
  );
}
