"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

// Import the words from the public directory
import wordsData from "../../public/words.json";

// Add german to the Word type
type Word = {
  english: string;
  spanish: string;
  german: string;
};

type CardAnim = {
  top: number;
  opacity: number;
  transition: string;
  rotate: number;
  x?: number; // for drag
};

// Make the offset a bit larger for bigger cards
const OFFSET = 5;
const DRAG_THRESHOLD = 100; // px, a bit longer for bigger cards

const LANGUAGES = [
  { code: "english", label: "English" },
  { code: "spanish", label: "Spanish" },
  { code: "german", label: "German" },
];

// Helper to generate random rotation between -12 and 12 degrees
function getRandomRotation(): number {
  return Math.random() * 180 - 90;
}

// Extract categories from wordsData
const CATEGORY_KEYS = Object.keys(wordsData);

const CATEGORY_LABELS: Record<string, string> = {
  basic_interactions: "Basic Interactions",
  common_statements: "Common Statements",
  days: "Days of the Week",
  numbers: "Numbers",
  verbs: "Verbs",
  colors: "Colors",
};

export default function Flashcards() {
  // To avoid hydration mismatch, render nothing until mounted
  const [mounted, setMounted] = useState(false);

  // Category selection state
  const [category, setCategory] = useState<string>(CATEGORY_KEYS[0] || "");

  // Language selection state
  const [fromLang, setFromLang] = useState<string>("english");
  const [toLang, setToLang] = useState<string>("spanish");
  // Used to trigger shuffle animation when language or category changes
  const [langShuffleKey, setLangShuffleKey] = useState<number>(0);

  // Get the words for the selected category from the imported JSON
  const words: Word[] = useMemo(() => {
    if (!category) return [];
    const arr = (wordsData as any)[category];
    return Array.isArray(arr) ? arr : [];
  }, [category]);

  const CARD_COUNT = words.length;

  // Store initial random rotations for each card (only on client)
  const [initialRotations, setInitialRotations] = useState<number[]>([]);

  // Cards start even higher and fully opaque
  const [anims, setAnims] = useState<CardAnim[]>(
    Array.from({ length: CARD_COUNT }, () => ({
      top: -2000,
      opacity: 1,
      transition: "none",
      rotate: 0,
      x: 0,
    }))
  );

  // The queue of card indices, front is 0
  const [queue, setQueue] = useState<number[]>(Array.from({ length: CARD_COUNT }, (_, i) => i));

  // Track which card is being dragged (index in queue, not cardIdx)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const dragStartX = useRef<number>(0);
  const dragDeltaX = useRef<number>(0);

  // Track cards currently animating out, so we can allow new drags while previous card is animating
  const [animatingOutCards, setAnimatingOutCards] = useState<Set<number>>(new Set());

  // Per-card state: whether the card is showing the translation in the bottom left
  // We'll use a map from cardIdx to boolean (true = show translation, false = hide translation)
  const [showTranslation, setShowTranslation] = useState<Record<number, boolean>>(
    () => Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false]))
  );

  // Per-card state: whether the card is "flipped" (i.e., black background)
  const [cardFlipped, setCardFlipped] = useState<Record<number, boolean>>(
    () => Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false]))
  );

  // Per-card state: animate black fill
  const [cardFilling, setCardFilling] = useState<Record<number, boolean>>(
    () => Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false]))
  );

  // Per-card state: black fill progress (0 to 1)
  const [cardFillProgress, setCardFillProgress] = useState<Record<number, number>>(
    () => Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0]))
  );

  // Per-card state: animating black shrink (for white flip)
  const [cardUnfilling, setCardUnfilling] = useState<Record<number, boolean>>(
    () => Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false]))
  );
  // Per-card state: black shrink progress (1 to 0)
  const [cardUnfillProgress, setCardUnfillProgress] = useState<Record<number, number>>(
    () => Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0]))
  );

  // Helper to reset cards in with new language selection
  // (no-op, handled in useEffect below)

  // When category changes, reset all per-card state and anims
  useEffect(() => {
    setInitialRotations(Array.from({ length: CARD_COUNT }, () => getRandomRotation()));
    setAnims(
      Array.from({ length: CARD_COUNT }, () => ({
        top: -2000,
        opacity: 1,
        transition: "none",
        rotate: 0,
        x: 0,
      }))
    );
    setQueue(Array.from({ length: CARD_COUNT }, (_, i) => i));
    setAnimatingOutCards(new Set());
    setDraggingIdx(null);
    setShowTranslation(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    setCardFlipped(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    setCardFilling(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    setCardFillProgress(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0])));
    setCardUnfilling(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    setCardUnfillProgress(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0])));
    setLangShuffleKey((k) => k + 1); // force shuffle animation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, CARD_COUNT]);

  useEffect(() => {
    // Only run on client
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || initialRotations.length !== CARD_COUNT) return;

    // Set initial anims with random rotations, fully opaque, even higher
    setAnims(
      Array.from({ length: CARD_COUNT }, (_, idx) => ({
        top: -2000,
        opacity: 1,
        transition: "none",
        rotate: initialRotations[idx],
        x: 0,
      }))
    );

    // Animate cards in, staggered with delay, from back to front
    Array.from({ length: CARD_COUNT }, (_, i) => {
      setTimeout(() => {
        setAnims((prev) => {
          const next = [...prev];
          next[i] = {
            top: OFFSET * (CARD_COUNT - 1 - i),
            opacity: 1,
            transition:
              "top 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)",
            rotate: 0,
            x: 0,
          };
          return next;
        });
      }, 100 + i * 100);
    });
    setQueue(Array.from({ length: CARD_COUNT }, (_, i) => i));
    setAnimatingOutCards(new Set());
    setDraggingIdx(null);
    // Reset all cards to hide translation
    setShowTranslation(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    // Reset all cards to not flipped
    setCardFlipped(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    // Reset all cards to not filling
    setCardFilling(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    // Reset all cards to fill progress 0
    setCardFillProgress(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0])));
    // Reset all cards to not unfilling
    setCardUnfilling(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
    // Reset all cards to unfill progress 0
    setCardUnfillProgress(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0])));
  }, [mounted, initialRotations, CARD_COUNT, langShuffleKey]);

  // Drag handlers for the top card
  function handleDragStart(e: React.MouseEvent | React.TouchEvent): void {
    // Only allow drag if not already dragging and the top card is not animating out
    if (draggingIdx !== null) return;
    const topQueueIdx = queue.length - 1;
    const topCardIdx = queue[topQueueIdx];
    if (animatingOutCards.has(topCardIdx)) return;

    setDraggingIdx(topQueueIdx);
    if ("touches" in e) {
      dragStartX.current = e.touches[0].clientX;
    } else {
      dragStartX.current = e.clientX;
    }
    dragDeltaX.current = 0;
    // Remove transition for immediate drag
    setAnims((prev) => {
      const next = [...prev];
      next[topCardIdx] = {
        ...next[topCardIdx],
        transition: "none",
      };
      return next;
    });
  }

  function handleDragMove(e: React.MouseEvent | React.TouchEvent): void {
    if (draggingIdx === null) return;
    let clientX = 0;
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }
    const deltaX = clientX - dragStartX.current;
    dragDeltaX.current = deltaX;
    // Move the dragged card visually
    setAnims((prev) => {
      const next = [...prev];
      const cardIdx = queue[draggingIdx];
      next[cardIdx] = {
        ...next[cardIdx],
        x: deltaX,
        rotate: deltaX * 0.1, // slight rotation with drag
      };
      return next;
    });
  }

  function handleDragEnd(): void {
    if (draggingIdx === null) return;
    const deltaX = dragDeltaX.current;
    const cardIdx = queue[draggingIdx];

    if (Math.abs(deltaX) > DRAG_THRESHOLD) {
      // Animate card out to the side, then move to back
      setAnims((prev) => {
        const next = [...prev];
        next[cardIdx] = {
          ...next[cardIdx],
          x: deltaX > 0 ? 700 : -700,
          opacity: 0,
          transition:
            "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          rotate: deltaX > 0 ? 15 : -15,
        };
        return next;
      });

      // Mark this card as animating out
      setAnimatingOutCards((prev) => {
        const newSet = new Set(prev);
        newSet.add(cardIdx);
        return newSet;
      });

      // Move card to back of queue immediately, so next card is draggable right away
      setQueue((prevQueue) => {
        const newQueue = [...prevQueue];
        // Remove the card at draggingIdx
        const [removed] = newQueue.splice(draggingIdx, 1);
        if (typeof removed === "number") {
          newQueue.unshift(removed);
        }
        return newQueue;
      });

      // After animation, reset anim for the moved card and re-stack all cards
      setTimeout(() => {
        setAnims((prev) => {
          const next = [...prev];
          // The card that was just moved to the back is now at queue[0]
          next[cardIdx] = {
            top: OFFSET * (CARD_COUNT - 1),
            opacity: 1,
            transition:
              "top 0.4s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s",
            rotate: 0,
            x: 0,
          };
          // Re-stack all cards
          setQueue((q) => {
            q.forEach((cIdx, i) => {
              next[cIdx] = {
                ...next[cIdx],
                top: OFFSET * (CARD_COUNT - 1 - i),
                transition:
                  "top 0.4s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
              };
            });
            return q;
          });
          return next;
        });
        // Remove from animatingOutCards
        setAnimatingOutCards((prev) => {
          const newSet = new Set(prev);
          newSet.delete(cardIdx);
          return newSet;
        });
        // Reset translation and flip state for the card that just went to the back
        setShowTranslation((prev) => ({
          ...prev,
          [cardIdx]: false,
        }));
        setCardFlipped((prev) => ({
          ...prev,
          [cardIdx]: false,
        }));
        setCardFilling((prev) => ({
          ...prev,
          [cardIdx]: false,
        }));
        setCardFillProgress((prev) => ({
          ...prev,
          [cardIdx]: 0,
        }));
        setCardUnfilling((prev) => ({
          ...prev,
          [cardIdx]: false,
        }));
        setCardUnfillProgress((prev) => ({
          ...prev,
          [cardIdx]: 0,
        }));
      }, 300);
    } else {
      // Snap back to center
      setAnims((prev) => {
        const next = [...prev];
        next[cardIdx] = {
          ...next[cardIdx],
          x: 0,
          rotate: 0,
          transition:
            "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        };
        return next;
      });
    }
    setDraggingIdx(null);
  }

  // Mouse/touch event handlers for the top card
  function addDragHandlers<T extends object>(props: T): T & {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  } {
    return {
      onMouseDown: (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e);
        window.addEventListener("mousemove", handleDragMoveWin as EventListener);
        window.addEventListener("mouseup", handleDragEndWin as EventListener);
      },
      onTouchStart: (e: React.TouchEvent) => {
        handleDragStart(e);
        window.addEventListener("touchmove", handleDragMoveWin as EventListener, { passive: false });
        window.addEventListener("touchend", handleDragEndWin as EventListener);
      },
      ...props,
    };
  }

  // These are needed to handle drag outside the card
  function handleDragMoveWin(e: MouseEvent | TouchEvent): void {
    if ("touches" in e) {
      if (e.touches.length === 0) return;
      handleDragMove(e as unknown as React.TouchEvent);
    } else {
      handleDragMove(e as unknown as React.MouseEvent);
    }
  }
  function handleDragEndWin(): void {
    handleDragEnd();
    window.removeEventListener("mousemove", handleDragMoveWin as EventListener);
    window.removeEventListener("mouseup", handleDragEndWin as EventListener);
    window.removeEventListener("touchmove", handleDragMoveWin as EventListener);
    window.removeEventListener("touchend", handleDragEndWin as EventListener);
  }

  useEffect(() => {
    // Clean up listeners on unmount
    return () => {
      window.removeEventListener("mousemove", handleDragMoveWin as EventListener);
      window.removeEventListener("mouseup", handleDragEndWin as EventListener);
      window.removeEventListener("touchmove", handleDragMoveWin as EventListener);
      window.removeEventListener("touchend", handleDragEndWin as EventListener);
    };
    // eslint-disable-next-line
  }, []);

  // Handle language or category change: shuffle out, then shuffle in with new language/category
  function handleLangChange(type: "from" | "to", value: string): void {
    if (type === "from") {
      setFromLang(value);
    } else {
      setToLang(value);
    }

    // Animate all cards out (shuffle out)
    setAnims((prev) => {
      const next = [...prev];
      queue.forEach((cardIdx, i) => {
        next[cardIdx] = {
          ...next[cardIdx],
          x: (i % 2 === 0 ? 1 : -1) * 800,
          opacity: 0,
          transition:
            "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        };
      });
      return next;
    });

    // After shuffle out, shuffle in new cards
    setTimeout(() => {
      setLangShuffleKey((k) => k + 1);
      // Reset all cards to hide translation
      setShowTranslation(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
      // Reset all cards to not flipped
      setCardFlipped(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
      // Reset all cards to not filling
      setCardFilling(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
      // Reset all cards to fill progress 0
      setCardFillProgress(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0])));
      // Reset all cards to not unfilling
      setCardUnfilling(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, false])));
      // Reset all cards to unfill progress 0
      setCardUnfillProgress(Object.fromEntries(Array.from({ length: CARD_COUNT }, (_, i) => [i, 0])));
    }, 400);
  }

  function handleCategoryChange(value: string): void {
    // Animate all cards out (shuffle out)
    setAnims((prev) => {
      const next = [...prev];
      queue.forEach((cardIdx, i) => {
        next[cardIdx] = {
          ...next[cardIdx],
          x: (i % 2 === 0 ? 1 : -1) * 800,
          opacity: 0,
          transition:
            "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        };
      });
      return next;
    });

    // After shuffle out, change category and shuffle in new cards
    setTimeout(() => {
      setCategory(value);
      // The useEffect on [category, CARD_COUNT] will handle resetting state and anims and incrementing langShuffleKey
    }, 400);
  }

  // Handler to show/hide translation in the bottom left and flip card
  function handleShowTranslation(cardIdx: number): void {
    // If flipping to black, animate fill first, then flip
    if (!cardFlipped[cardIdx]) {
      setCardFilling((prev) => ({
        ...prev,
        [cardIdx]: true,
      }));
      setShowTranslation((prev) => ({
        ...prev,
        [cardIdx]: true,
      }));

      // Animate fill progress from 0 to 1 over 250ms (was 400ms)
      let start: number | null = null;
      function animateFill(ts: number) {
        if (start === null) start = ts;
        const elapsed = ts - start;
        const progress = Math.min(elapsed / 250, 1);
        setCardFillProgress((prev) => ({
          ...prev,
          [cardIdx]: progress,
        }));
        if (progress < 1) {
          requestAnimationFrame(animateFill);
        } else {
          setCardFlipped((prev) => ({
            ...prev,
            [cardIdx]: true,
          }));
          setCardFilling((prev) => ({
            ...prev,
            [cardIdx]: false,
          }));
        }
      }
      setCardFillProgress((prev) => ({
        ...prev,
        [cardIdx]: 0,
      }));
      requestAnimationFrame(animateFill);
    } else {
      // If flipping back, animate black shrinking from top left to bottom right
      setCardUnfilling((prev) => ({
        ...prev,
        [cardIdx]: true,
      }));
      setCardUnfillProgress((prev) => ({
        ...prev,
        [cardIdx]: 1,
      }));
      // Hide translation at the end of the animation
      let start: number | null = null;
      function animateUnfill(ts: number) {
        if (start === null) start = ts;
        const elapsed = ts - start;
        const progress = Math.max(1 - elapsed / 250, 0);
        setCardUnfillProgress((prev) => ({
          ...prev,
          [cardIdx]: progress,
        }));
        if (progress > 0) {
          requestAnimationFrame(animateUnfill);
        } else {
          setCardFlipped((prev) => ({
            ...prev,
            [cardIdx]: false,
          }));
          setShowTranslation((prev) => ({
            ...prev,
            [cardIdx]: false,
          }));
          setCardUnfilling((prev) => ({
            ...prev,
            [cardIdx]: false,
          }));
          setCardUnfillProgress((prev) => ({
            ...prev,
            [cardIdx]: 0,
          }));
          setCardFilling((prev) => ({
            ...prev,
            [cardIdx]: false,
          }));
          setCardFillProgress((prev) => ({
            ...prev,
            [cardIdx]: 0,
          }));
        }
      }
      requestAnimationFrame(animateUnfill);
    }
  }

  if (!mounted) return null;

  // Render cards in queue order, bottom to top
  return (
    <div className="flex justify-center flex-col items-center h-screen select-none">
      {/* Black fill animation styles */}
      <style>
        {`
        .card-black-fill-anim {
          position: absolute;
          left: 0; top: 0; right: 0; bottom: 0;
          border-radius: 1.5rem;
          background: #000;
          z-index: 1;
          pointer-events: none;
          /* Default: fill from bottom right (black grows) */
          transform-origin: 100% 100%;
          transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        .card-black-unfill-anim {
          position: absolute;
          left: 0; top: 0; right: 0; bottom: 0;
          border-radius: 1.5rem;
          background: #000;
          z-index: 1;
          pointer-events: none;
          /* Shrink from top left (black shrinks) */
          transform-origin: 0% 0%;
          transition: transform 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        .flip-btn-transition {
          transition: background-color 0.4s, color 0.5s;
        }
        `}
      </style>
      <div className="relative w-[480px] h-[640px]">
        {queue.map((cardIdx, i) => {
          // Only allow drag handlers if this is the top card and it's not animating out and not being dragged
          const isTop = i === queue.length - 1;
          const anim = anims[cardIdx] || {};
          const canDrag =
            isTop &&
            !animatingOutCards.has(cardIdx) &&
            (draggingIdx === null || draggingIdx === i);

          // Get the word for this card
          const word = words[cardIdx];

          // The button label: "Show [other language]"
          const flipButtonLabel = !showTranslation[cardIdx]
            ? `Show ${LANGUAGES.find((l) => l.code === toLang)?.label ?? toLang}`
            : `Hide ${LANGUAGES.find((l) => l.code === toLang)?.label ?? toLang}`;

          // Always use light bg, but overlay black fill for animation
          const cardBgClass = "bg-[#FAFAFA]";

          // Determine border color
          const borderColorClass = cardFlipped[cardIdx] || cardFilling[cardIdx] || cardUnfilling[cardIdx]
            ? "border-[#E6E6E6]"
            : "border-[#E6E6E6]";

          // Black fill progress (0 to 1)
          const fillProgress = cardFlipped[cardIdx]
            ? 1
            : cardFilling[cardIdx]
            ? cardFillProgress[cardIdx] ?? 0
            : 0;

          // Black unfill progress (1 to 0)
          const unfillProgress = cardUnfilling[cardIdx]
            ? cardUnfillProgress[cardIdx] ?? 0
            : 0;

          // Show the word if the card is being filled, is flipped, is being unfilling, or is the top card and not being filled/flipped
          // (i.e., show the word on the top card when it's white and not animating)
          const showWord =
            fillProgress > 0 ||
            cardFlipped[cardIdx] ||
            cardFilling[cardIdx] ||
            cardUnfilling[cardIdx] ||
            (isTop && !cardFlipped[cardIdx] && !cardFilling[cardIdx] && !cardUnfilling[cardIdx]);

          // Calculate the color for both the top word and the bottom word using the same logic
          // (fade from black to white as fill progresses, and fade back to black as unfill progresses)
          let wordColor: string;
          if (cardUnfilling[cardIdx]) {
            // Animate from white to black as unfill progresses from 1 to 0
            wordColor =
              unfillProgress === 0
                ? "#000"
                : unfillProgress === 1
                ? "#fff"
                : `rgb(${255 - 255 * unfillProgress},${255 - 255 * unfillProgress},${255 - 255 * unfillProgress})`;
          } else {
            wordColor =
              fillProgress === 1
                ? "#fff"
                : fillProgress === 0
                ? "#000"
                : `rgb(${255 - 255 * fillProgress},${255 - 255 * fillProgress},${255 - 255 * fillProgress})`;
          }

          // Determine if the card is "black" (i.e., fully flipped or filling)
          const isCardBlack =
            (cardFlipped[cardIdx] && !cardUnfilling[cardIdx]) ||
            (cardFilling[cardIdx] && !cardUnfilling[cardIdx] && fillProgress > 0);

          // Button color: white when card is black, black otherwise
          const buttonBgColor = isCardBlack ? "bg-white" : "bg-black";
          const buttonIconColor = isCardBlack ? "#000" : "#fff";

          return (
            <div
              key={cardIdx}
              className={`absolute left-0 right-0 mx-auto w-[420px] h-[520px] rounded-3xl border touch-none overflow-hidden ${cardBgClass} ${borderColorClass}`}
              style={{
                top: anim.top ?? -2000,
                zIndex: i + 1,
                opacity: anim.opacity ?? 1,
                transition: anim.transition ?? "none",
                transform: `translateX(${anim.x ?? 0}px) rotate(${anim.rotate ?? 0}deg)`,
                cursor: canDrag ? (draggingIdx !== null ? "grabbing" : "grab") : "default",
                userSelect: "none",
              }}
              {...(canDrag ? addDragHandlers({}) : {})}
            >
              {/* Black fill animation overlay */}
              {/* Show black fill when filling or flipped */}
              {(cardFilling[cardIdx] || cardFlipped[cardIdx]) && !cardUnfilling[cardIdx] && (
                <div
                  className="card-black-fill-anim rounded-3xl"
                  style={{
                    transform: `scale(${fillProgress},${fillProgress})`,
                    transition: cardFilling[cardIdx] || cardFlipped[cardIdx]
                      ? "transform 0.25s cubic-bezier(0.22,1,0.36,1)"
                      : "none",
                  }}
                />
              )}
              {/* Black unfill animation overlay (shrinks from top left) */}
              {cardUnfilling[cardIdx] && (
                <div
                  className="card-black-unfill-anim rounded-3xl"
                  style={{
                    transform: `scale(${unfillProgress},${unfillProgress})`,
                    transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
                  }}
                />
              )}
              <div className="px-8 py-6 h-full select-none pointer-events-none relative z-10 flex flex-col">
                {/* Word with color transition as black fill crosses */}
                <div className="relative w-full flex" style={{height: "56px"}}>
                  {showWord && (
                    <span
                      className="absolute left-0 right-0 w-full text-4xl font-bold text-[#FAFAFA]"
                      style={{
                        color: wordColor,
                        transition: "color 0.25s",
                        zIndex: 2,
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    >
                      {word?.[fromLang as keyof Word]}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={`w-6 h-6 rounded-full cursor-pointer absolute bottom-6 right-8 flex items-center justify-center flip-btn-transition ${buttonBgColor}`}
                  style={{
                    pointerEvents: "auto",
                    color: buttonIconColor,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowTranslation(cardIdx);
                  }}
                  tabIndex={0}
                  aria-label={flipButtonLabel}
                >
                  {/* Optionally, you can add an icon here, e.g. an eye or arrows, using SVG and set its fill to currentColor */}
                </button>
                {/* Show translation in bottom left if toggled or filling or unfilling */}
                {(showTranslation[cardIdx] || cardFilling[cardIdx] || cardUnfilling[cardIdx]) && (
                  <div
                    className={`absolute bottom-6 left-8 text-4xl font-bold`}
                    style={{
                      minWidth: "120px",
                      maxWidth: "220px",
                      wordBreak: "break-word",
                      color: wordColor,
                      transition: "color 0.25s",
                    }}
                  >
                    <span className="text-[#FAFAFA]">{word?.[toLang as keyof Word]}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-row gap-12 mt-12 items-center">
        <div className="flex flex-col items-center">
          <label htmlFor="from-lang" className="mb-2 text-lg text-gray-600 font-semibold">
            FROM:
          </label>
          <select
            id="from-lang"
            className="border rounded px-4 py-2 text-lg"
            value={fromLang}
            onChange={(e) => handleLangChange("from", e.target.value)}
          >
            {LANGUAGES.filter((l) => l.code !== toLang).map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center">
          <label htmlFor="to-lang" className="mb-2 text-lg text-gray-600 font-semibold">
            TO:
          </label>
          <select
            id="to-lang"
            className="border rounded px-4 py-2 text-lg"
            value={toLang}
            onChange={(e) => handleLangChange("to", e.target.value)}
          >
            {LANGUAGES.filter((l) => l.code !== fromLang).map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col items-center">
          <label htmlFor="category" className="mb-2 text-lg text-gray-600 font-semibold">
            CATEGORY:
          </label>
          <select
            id="category"
            className="border rounded px-4 py-2 text-lg"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            {CATEGORY_KEYS.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
