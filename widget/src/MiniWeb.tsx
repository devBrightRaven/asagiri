// src/MiniWeb.tsx
import { h } from "preact";
import { useRef, useEffect } from "preact/hooks";
import type { Fragment, Connection } from "./types";

interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export function computeWebLayout(
  items: { id: string; label: string }[],
  width: number,
  height: number
): LayoutNode[] {
  if (items.length === 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) * 0.7;

  return items.map((item, i) => {
    const angle = (2 * Math.PI * i) / items.length - Math.PI / 2;
    return {
      ...item,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

interface Props {
  fragments: Fragment[];
  connections: Connection[];
  width?: number;
  height?: number;
}

export function MiniWeb({ fragments, connections, width = 300, height = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width * 2; // retina
    canvas.height = height * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, width, height);

    const items = fragments.slice(-12).map((f) => ({
      id: f.id,
      label: f.content.slice(0, 20),
    }));
    const nodes = computeWebLayout(items, width, height);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Draw connections
    ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
    ctx.lineWidth = 1;
    for (const conn of connections) {
      const a = nodeMap.get(conn.fragment_a);
      const b = nodeMap.get(conn.fragment_b);
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
    }

    // Center dot
    if (nodes.length > 0) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99, 102, 241, 0.4)";
      ctx.fill();

      // Draw radial lines to center
      ctx.strokeStyle = "rgba(99, 102, 241, 0.1)";
      for (const node of nodes) {
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      }
    }
  }, [fragments, connections, width, height]);

  return (
    <div class="sg-web-preview">
      <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} />
    </div>
  );
}
