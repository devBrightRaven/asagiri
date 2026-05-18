// src/useDraggable.ts
/**
 * Custom hook for making elements draggable within the viewport.
 * Distinguishes between drag and click — if the pointer moves more than
 * 4px during a mousedown, it's a drag (not a click).
 */
import { useState, useRef, useCallback, useEffect } from "preact/hooks";

interface Position {
  x: number;
  y: number;
}

interface DraggableResult {
  position: Position;
  isDragging: boolean;
  wasDragged: boolean;
  handleMouseDown: (e: MouseEvent) => void;
}

const DRAG_THRESHOLD = 4; // px — movement below this counts as a click

export function useDraggable(
  initialPosition: Position,
  elementSize: { width: number; height: number }
): DraggableResult {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const wasDraggedRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; elX: number; elY: number } | null>(null);
  const thresholdPassedRef = useRef(false);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Only left button
    if (e.button !== 0) return;
    e.preventDefault();

    wasDraggedRef.current = false;
    thresholdPassedRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elX: position.x,
      elY: position.y,
    };
    setIsDragging(true);
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      // Check threshold
      if (!thresholdPassedRef.current) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        thresholdPassedRef.current = true;
        wasDraggedRef.current = true;
      }

      // Clamp to viewport
      const newX = Math.max(0, Math.min(
        window.innerWidth - elementSize.width,
        dragStartRef.current.elX + dx
      ));
      const newY = Math.max(0, Math.min(
        window.innerHeight - elementSize.height,
        dragStartRef.current.elY + dy
      ));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    // Attach to window so drag continues even if cursor leaves the element
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, elementSize]);

  return {
    position,
    isDragging,
    wasDragged: wasDraggedRef.current,
    handleMouseDown,
  };
}
