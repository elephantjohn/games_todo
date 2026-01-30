"use client";

import React, { useEffect, useRef, useState } from "react";
import Matter from "matter-js";
import { RefreshCw, Trophy } from "lucide-react";

// Fruit configuration
const FRUITS = [
  { label: "Grape", radius: 15, color: "#9333EA", score: 2 },      // Purple
  { label: "Cherry", radius: 22, color: "#DC2626", score: 4 },     // Red
  { label: "Orange", radius: 30, color: "#F97316", score: 8 },     // Orange
  { label: "Lemon", radius: 38, color: "#FACC15", score: 16 },     // Yellow
  { label: "Kiwi", radius: 47, color: "#84CC16", score: 32 },      // Lime
  { label: "Tomato", radius: 57, color: "#EF4444", score: 64 },    // Red
  { label: "Peach", radius: 68, color: "#F472B6", score: 128 },    // Pink
  { label: "Pineapple", radius: 80, color: "#EAB308", score: 256 },// Yellow-Gold
  { label: "Coconut", radius: 93, color: "#A8A29E", score: 512 },  // Warm Gray
  { label: "Melon", radius: 107, color: "#22C55E", score: 1024 }, // Green
  { label: "Watermelon", radius: 125, color: "#15803D", score: 2048 }, // Dark Green
];

export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextFruitIndex, setNextFruitIndex] = useState(0);
  
  // Refs for game state to access inside closures/events
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const currentFruitRef = useRef<Matter.Body | null>(null);
  const isDroppingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    // --- Setup Matter.js ---
    const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Events = Matter.Events,
      World = Matter.World;

    const width = Math.min(window.innerWidth, 480);
    const height = Math.min(window.innerHeight, 800);
    const wallThickness = 20;

    const engine = Engine.create();
    engineRef.current = engine;

    const render = Render.create({
      element: containerRef.current,
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: "#FFFBEB", // amber-50
        pixelRatio: window.devicePixelRatio,
      },
    });
    renderRef.current = render;

    // --- Boundaries ---
    const ground = Bodies.rectangle(width / 2, height + wallThickness / 2 - 10, width, wallThickness, { 
      isStatic: true,
      render: { fillStyle: "#78350F" } 
    });
    const leftWall = Bodies.rectangle(0 - wallThickness / 2, height / 2, wallThickness, height * 2, { 
      isStatic: true, 
      render: { fillStyle: "#78350F" }
    });
    const rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { 
      isStatic: true, 
      render: { fillStyle: "#78350F" }
    });
    // Top sensor line for game over
    const topSensor = Bodies.rectangle(width / 2, 100, width, 2, {
      isStatic: true,
      isSensor: true,
      render: { fillStyle: "rgba(255, 0, 0, 0.2)", visible: true }
    });

    Composite.add(engine.world, [ground, leftWall, rightWall, topSensor]);

    // --- Input Handling ---
    const spawnFruit = (x: number, index: number, isPreview = true) => {
      const fruitConfig = FRUITS[index];
      const body = Bodies.circle(x, 50, fruitConfig.radius, {
        label: `fruit-${index}`,
        isStatic: isPreview,
        restitution: 0.3, // Bounciness
        render: { fillStyle: fruitConfig.color }
      });
      return body;
    };

    // Initial spawn setup
    setNextFruitIndex(Math.floor(Math.random() * 3)); // Start with small fruits

    // --- Collision Logic (Merge) ---
    Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Check if both are fruits
        if (bodyA.label.startsWith("fruit-") && bodyB.label.startsWith("fruit-")) {
          const indexA = parseInt(bodyA.label.split("-")[1]);
          const indexB = parseInt(bodyB.label.split("-")[1]);

          if (indexA === indexB && indexA < FRUITS.length - 1) {
            // Check if they are already being removed to avoid double merge
            if (!World.get(engine.world, bodyA.id) || !World.get(engine.world, bodyB.id)) return;

            // Merge!
            const newX = (bodyA.position.x + bodyB.position.x) / 2;
            const newY = (bodyA.position.y + bodyB.position.y) / 2;
            const newIndex = indexA + 1;

            Composite.remove(engine.world, [bodyA, bodyB]);
            
            const newFruit = spawnFruit(newX, newIndex, false);
            Matter.Body.setPosition(newFruit, { x: newX, y: newY });
            Composite.add(engine.world, newFruit);
            
            // Add slight pop/scale effect via velocity maybe? 
            // Matter.Body.setVelocity(newFruit, { x: (Math.random() - 0.5) * 2, y: -2 });

            setScore(prev => prev + FRUITS[indexA].score);
          }
        }
      });
    });

    // --- Game Loop ---
    Render.run(render);
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);

    // --- Cleanup ---
    return () => {
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas) render.canvas.remove();
      World.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, []);

  // --- Input Actions ---
  const handleInputStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameOver || isDroppingRef.current || !engineRef.current) return;
    
    // Get X coordinate
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    
    let x = clientX - canvasRect.left;
    // Clamp x to boundaries
    const radius = FRUITS[nextFruitIndex].radius;
    x = Math.max(radius + 20, Math.min(canvasRect.width - radius - 20, x));

    // Create preview fruit
    const preview = Matter.Bodies.circle(x, 50, radius, {
      label: `preview`,
      isStatic: true,
      collisionFilter: { mask: 0 }, // No collision
      render: { fillStyle: FRUITS[nextFruitIndex].color, opacity: 0.5 }
    });
    
    currentFruitRef.current = preview;
    Matter.Composite.add(engineRef.current.world, preview);
  };

  const handleInputMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!currentFruitRef.current || isDroppingRef.current || !canvasRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    let x = clientX - canvasRect.left;
    const radius = FRUITS[nextFruitIndex].radius;
    x = Math.max(radius + 20, Math.min(canvasRect.width - radius - 20, x));

    Matter.Body.setPosition(currentFruitRef.current, { x, y: 50 });
  };

  const handleInputEnd = () => {
    if (!currentFruitRef.current || isDroppingRef.current || !engineRef.current) return;
    
    isDroppingRef.current = true;
    const x = currentFruitRef.current.position.x;
    
    // Remove preview
    Matter.Composite.remove(engineRef.current.world, currentFruitRef.current);
    currentFruitRef.current = null;

    // Drop real fruit
    const realFruit = Matter.Bodies.circle(x, 50, FRUITS[nextFruitIndex].radius, {
      label: `fruit-${nextFruitIndex}`,
      restitution: 0.3,
      render: { fillStyle: FRUITS[nextFruitIndex].color }
    });
    Matter.Composite.add(engineRef.current.world, realFruit);

    // Prepare next turn
    setTimeout(() => {
      isDroppingRef.current = false;
      setNextFruitIndex(Math.floor(Math.random() * 5)); // Random next fruit (0-4)
    }, 500);
  };

  const restartGame = () => {
    if (!engineRef.current) return;
    Matter.Composite.clear(engineRef.current.world, false, true); // Keep static bodies
    // Re-add static bodies if they got cleared? Composite.clear usually keeps them if keepStatic is true
    // But let's verify. Actually safest to reload page or re-init, but let's try deep clean.
    
    // Actually, just clearing non-static bodies is enough
    const bodies = Matter.Composite.allBodies(engineRef.current.world);
    bodies.forEach(b => {
      if (!b.isStatic || b.label.startsWith('fruit')) {
        if (!b.isStatic || b.label !== '') // Don't remove walls
        Matter.Composite.remove(engineRef.current!.world, b);
      }
    });
    
    setScore(0);
    setGameOver(false);
    isDroppingRef.current = false;
  };

  return (
    <div className="relative w-full max-w-md mx-auto h-[800px] bg-amber-50 rounded-xl overflow-hidden shadow-2xl border-4 border-amber-900/20">
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-bold text-amber-900 text-lg">{score}</span>
        </div>
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium text-amber-700">
          Next: {FRUITS[nextFruitIndex]?.label}
        </div>
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/50 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-xl text-center animate-in zoom-in duration-300">
            <h2 className="text-3xl font-bold text-amber-900 mb-2">Game Over!</h2>
            <p className="text-amber-600 mb-6">Final Score: {score}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Canvas Layer */}
      <div 
        ref={containerRef}
        onMouseDown={handleInputStart}
        onMouseMove={handleInputMove}
        onMouseUp={handleInputEnd}
        onTouchStart={handleInputStart}
        onTouchMove={handleInputMove}
        onTouchEnd={handleInputEnd}
        className="w-full h-full cursor-pointer"
      >
        <canvas ref={canvasRef} />
      </div>
      
      <div className="absolute bottom-2 w-full text-center text-amber-900/40 text-xs pointer-events-none">
        Tap and drag to drop • Merge fruits to win
      </div>
    </div>
  );
}
