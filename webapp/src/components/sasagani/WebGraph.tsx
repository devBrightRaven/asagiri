"use client";

import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import type { Fragment, Connection } from "@/lib/types";

interface Props {
  fragments: Fragment[];
  connections: Connection[];
  width?: number;
  height?: number;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: Fragment["type"];
  threadId: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  strength: number;
  description: string;
}

const THREAD_COLORS = ["#6366f1", "#f59e0b", "#10b981"];

export function WebGraph({
  fragments,
  connections,
  width = 600,
  height = 400,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  const threadColorMap = useMemo(() => {
    const threadIds = [...new Set(fragments.map((f) => f.thread_id))];
    const map: Record<string, string> = {};
    threadIds.forEach((id, i) => {
      map[id] = THREAD_COLORS[i % THREAD_COLORS.length];
    });
    return map;
  }, [fragments]);

  const { nodes, links } = useMemo(() => {
    const nodes: Node[] = fragments.map((f) => ({
      id: f.id,
      label:
        f.type === "url"
          ? (() => {
              try {
                return new URL(f.content).hostname;
              } catch {
                return f.content.slice(0, 20);
              }
            })()
          : f.content.slice(0, 20),
      type: f.type,
      threadId: f.thread_id,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: Link[] = connections
      .filter((c) => nodeIds.has(c.fragment_a) && nodeIds.has(c.fragment_b))
      .map((c) => ({
        source: c.fragment_a,
        target: c.fragment_b,
        strength: c.strength,
        description: c.description,
      }));

    return { nodes, links };
  }, [fragments, connections]);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink<Node, Link>(links).id((d) => d.id).distance(80),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#888")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => 1 + d.strength * 4);

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", (d) => threadColorMap[d.threadId] ?? "#888")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .call(
        d3
          .drag<SVGCircleElement, Node>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as unknown as (selection: d3.Selection<d3.BaseType, Node, SVGGElement, unknown>) => void,
      );

    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", "10px")
      .attr("fill", "currentColor")
      .attr("dx", 12)
      .attr("dy", 4);

    node.append("title").text((d) => d.label);
    link.append("title").text((d) => d.description);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as Node).x!)
        .attr("y1", (d) => (d.source as Node).y!)
        .attr("x2", (d) => (d.target as Node).x!)
        .attr("y2", (d) => (d.target as Node).y!);
      node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);
      label.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height, threadColorMap]);

  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        還沒有碎片。丟些東西進來吧。
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="w-full"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="靈感蛛網圖"
    />
  );
}
