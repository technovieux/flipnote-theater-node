import React, { useState, useRef, useMemo, useEffect } from 'react';
import { EditorObject3D } from '@/types/editor';
import { Lightbulb, Sparkles, Sliders, Plug, Trash2, ZoomIn, ZoomOut, Maximize2, Mic, Headphones, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SpotlightFixture } from '@/types/spotlight';
import { FireworkProduct, FireworkCategory } from '@/types/fireworks';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ConsoleSpec {
  id: string;
  name: string;
  manufacturer: string;
  type: 'dmx' | 'audio' | 'hybrid';
  dmxIn: number;
  dmxOut: number;
  audioIn: number;
  audioOut: number;
  description: string;
}

export interface ConsoleNode {
  id: string;
  spec: ConsoleSpec;
}

export interface LogicalCable {
  id: string;
  from: string;
  to: string;
}

interface NodePos { x: number; y: number; }
type Category = 'console' | 'spot' | 'firework';
type PortSide = 'in' | 'out';
type PortKind = 'dmx' | 'audio';

interface LogicalViewProps {
  objects3D: EditorObject3D[];
  selectedObjectIds: string[];
  onSelect: (id: string | null, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  currentTime: number;
  onAddSpotlight?: (fixture: SpotlightFixture) => void;
  onAddFirework?: (product: FireworkProduct, category: FireworkCategory) => void;
  readOnly?: boolean;
  consoles: ConsoleNode[];
  setConsoles: React.Dispatch<React.SetStateAction<ConsoleNode[]>>;
  positions: Record<string, NodePos>;
  setPositions: React.Dispatch<React.SetStateAction<Record<string, NodePos>>>;
  cables: LogicalCable[];
  setCables: React.Dispatch<React.SetStateAction<LogicalCable[]>>;
  /** When true, hides spot and firework categories (drone mode). */
  droneMode?: boolean;
}

const FIRE_WINDOW_MS = 600;
const NODE_W = 200;
const PORT_ROW_H = 22;
const HEADER_H = 36;
const BODY_MIN = 40;

// Compute height for a console node based on its port counts
const consoleHeight = (s: ConsoleSpec) => {
  const rows = Math.max(s.dmxIn + s.dmxOut, s.audioIn > 0 || s.audioOut > 0 ? 1 : 0)
    + (s.audioIn + s.audioOut > 0 ? Math.max(s.audioIn, s.audioOut) : 0);
  // Use max of left-side rows vs right-side rows
  const leftRows = (s.dmxIn > 0 ? 1 : 0) + (s.audioIn > 0 ? 1 : 0);
  const rightRows = (s.dmxOut > 0 ? 1 : 0) + (s.audioOut > 0 ? 1 : 0);
  const portRows = Math.max(leftRows, rightRows, 1);
  return HEADER_H + BODY_MIN + portRows * PORT_ROW_H + 8;
};

const FIXTURE_H = 120;

const buildPortKey = (id: string, kind: PortKind, side: PortSide, idx: number) =>
  `${id}::${kind}::${side}::${idx}`;
const parsePortKey = (key: string) => {
  const [id, kind, side, idxStr] = key.split('::');
  return { id, kind: kind as PortKind, side: side as PortSide, idx: parseInt(idxStr, 10) };
};

export const LogicalView: React.FC<LogicalViewProps> = ({
  objects3D,
  selectedObjectIds,
  onSelect,
  currentTime,
  onAddSpotlight,
  onAddFirework,
  readOnly = false,
  consoles,
  setConsoles,
  positions,
  setPositions,
  cables,
  setCables,
  droneMode = false,
}) => {
  const fireworks = useMemo(() => objects3D.filter(o => o.type === 'firework'), [objects3D]);
  const spotlights = useMemo(
    () => objects3D.filter(o => o.type === 'spotlight_lyre' && o.spotlightFixture),
    [objects3D]
  );

  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<Category>('console');
  const [zoom, setZoom] = useState(1);

  const [consoleLib, setConsoleLib] = useState<ConsoleSpec[]>([]);
  const [fixtureLib, setFixtureLib] = useState<SpotlightFixture[]>([]);
  const [fireworkLib, setFireworkLib] = useState<FireworkProduct[]>([]);

  useEffect(() => {
    if (consoleLib.length === 0) {
      fetch('/data/consoles.json').then(r => r.json()).then(setConsoleLib).catch(console.error);
    }
    if (category === 'spot' && fixtureLib.length === 0) {
      fetch('/data/spotlight_fixtures.json').then(r => r.json()).then(setFixtureLib).catch(console.error);
    }
    if (category === 'firework' && fireworkLib.length === 0) {
      fetch('/data/consumer_fireworks.json').then(r => r.json()).then(setFireworkLib).catch(console.error);
    }
  }, [category, consoleLib.length, fixtureLib.length, fireworkLib.length]);

  // Initialize positions for new nodes
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
      let changed = false;
      consoles.forEach((c, i) => {
        if (!next[c.id]) { next[c.id] = { x: 40, y: 40 + i * 200 }; changed = true; }
      });
      spotlights.forEach((s, i) => {
        if (!next[s.id]) { next[s.id] = { x: 360 + (i % 3) * (NODE_W + 30), y: 40 + Math.floor(i / 3) * (FIXTURE_H + 30) }; changed = true; }
      });
      fireworks.forEach((f, i) => {
        const row = Math.floor(i / 3);
        if (!next[f.id]) { next[f.id] = { x: 360 + (i % 3) * (NODE_W + 30), y: 40 + (Math.ceil(spotlights.length / 3) + row) * (FIXTURE_H + 30) }; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [consoles, spotlights, fireworks, setPositions]);

  // DMX conflict detection
  const conflicts = useMemo(() => {
    const used: Record<number, string[]> = {};
    spotlights.forEach(s => {
      const fx = s.spotlightFixture!;
      const base = s.dmxAddress || 1;
      for (let i = 0; i < fx.channels.length; i++) (used[base + i] ||= []).push(s.id);
    });
    fireworks.forEach(f => {
      if (f.dmxAddress) (used[f.dmxAddress] ||= []).push(f.id);
    });
    const conflicting = new Set<string>();
    Object.values(used).forEach(ids => { if (ids.length > 1) ids.forEach(i => conflicting.add(i)); });
    return conflicting;
  }, [spotlights, fireworks]);

  // Drag handling
  const dragRef = useRef<{ id: string; offX: number; offY: number } | null>(null);
  const onNodePointerDown = (e: React.PointerEvent, id: string) => {
    if (readOnly || pendingFrom) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[id];
    if (!pos) return;
    const sx = (e.clientX - rect.left + (containerRef.current?.scrollLeft || 0)) / zoom;
    const sy = (e.clientY - rect.top + (containerRef.current?.scrollTop || 0)) / zoom;
    dragRef.current = { id, offX: sx - pos.x, offY: sy - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { id, offX, offY } = dragRef.current;
    const sx = (e.clientX - rect.left + (containerRef.current?.scrollLeft || 0)) / zoom;
    const sy = (e.clientY - rect.top + (containerRef.current?.scrollTop || 0)) / zoom;
    setPositions(p => ({ ...p, [id]: { x: Math.max(0, sx - offX), y: Math.max(0, sy - offY) } }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const removeCable = (id: string) => {
    if (readOnly) return;
    setCables(prev => prev.filter(c => c.id !== id));
  };

  // Build a map of port positions (offset within each node) for both consoles and fixtures
  const getPortAbsolute = (key: string): { x: number; y: number } | null => {
    const { id, kind, side, idx } = parsePortKey(key);
    const pos = positions[id];
    if (!pos) return null;

    // Console node?
    const c = consoles.find(c => c.id === id);
    if (c) {
      const s = c.spec;
      // Left side: row 0 = dmx in (if any), row 1 (or 0) = audio in start
      // Right side: row 0 = dmx out, row 1 = audio out start
      if (side === 'in') {
        // Stack: dmx_in rows, then audio_in rows
        const yOff = HEADER_H + 8 + idx * PORT_ROW_H + PORT_ROW_H / 2;
        return { x: pos.x, y: pos.y + yOff };
      } else {
        const yOff = HEADER_H + 8 + idx * PORT_ROW_H + PORT_ROW_H / 2;
        return { x: pos.x + NODE_W, y: pos.y + yOff };
      }
    }

    // Fixture (spotlight or firework): single port mid-height
    return {
      x: side === 'in' ? pos.x : pos.x + NODE_W,
      y: pos.y + FIXTURE_H / 2,
    };
  };

  const startCableFromPort = (key: string) => {
    if (readOnly) return;
    setPendingFrom(prev => prev === key ? null : key);
  };
  const tryConnectPort = (toKey: string) => {
    if (readOnly || !pendingFrom) return;
    const from = parsePortKey(pendingFrom);
    const to = parsePortKey(toKey);
    if (from.id === to.id) { setPendingFrom(null); return; }
    if (from.kind !== to.kind) { setPendingFrom(null); return; }
    if (from.side === to.side) { setPendingFrom(null); return; }
    const cableId = `${pendingFrom}->${toKey}`;
    setCables(prev => prev.some(c => c.id === cableId) ? prev : [...prev, { id: cableId, from: from.id, to: to.id }]);
    setPendingFrom(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  const portClickable = !readOnly;

  const addConsole = (spec: ConsoleSpec) => {
    setConsoles(prev => [...prev, { id: `console-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, spec }]);
  };

  const removeConsole = (id: string) => {
    setConsoles(prev => prev.filter(c => c.id !== id));
    setCables(prev => prev.filter(cb => cb.from !== id && cb.to !== id));
  };

  // Render a single port button
  const PortButton: React.FC<{
    nodeId: string; kind: PortKind; side: PortSide; idx: number;
    label: string;
  }> = ({ nodeId, kind, side, idx, label }) => {
    const key = buildPortKey(nodeId, kind, side, idx);
    const isPending = pendingFrom === key;
    const Icon = kind === 'dmx' ? Plug : (side === 'in' ? Mic : Headphones);
    const colorClass = kind === 'dmx' ? 'border-primary' : 'border-emerald-500';
    const pendingClass = kind === 'dmx' ? 'border-amber-500 bg-amber-500 text-black' : 'border-amber-500 bg-amber-500 text-black';
    return (
      <button
        disabled={!portClickable}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(key) : startCableFromPort(key); }}
        className={`absolute ${side === 'in' ? '-left-3' : '-right-3'} w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-accent transition ${isPending ? pendingClass : colorClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        title={label}
        style={{ top: HEADER_H + 8 + idx * PORT_ROW_H }}
      >
        <Icon className="h-3 w-3" />
      </button>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
    <div className="w-full h-full flex bg-muted/20">
      {/* Palette */}
      <div className="w-64 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-3 space-y-2 border-b border-border">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Catégories</div>
          <Button variant={category === 'console' ? 'default' : 'outline'} size="sm" className="w-full justify-start gap-2" onClick={() => setCategory('console')}>
            <Sliders className="h-4 w-4" /> Consoles
          </Button>
          <Button variant={category === 'spot' ? 'default' : 'outline'} size="sm" className="w-full justify-start gap-2" onClick={() => setCategory('spot')}>
            <Lightbulb className="h-4 w-4" /> Projecteurs
          </Button>
          <Button variant={category === 'firework' ? 'default' : 'outline'} size="sm" className="w-full justify-start gap-2" onClick={() => setCategory('firework')}>
            <Sparkles className="h-4 w-4" /> Feux d'artifice
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
            {category === 'console' ? 'Bibliothèque consoles' : category === 'spot' ? 'Bibliothèque projecteurs' : 'Bibliothèque feux'}
          </div>

          {category === 'console' && (
            <div className="grid grid-cols-2 gap-2">
              {consoleLib.map(c => {
                const TypeIcon = c.type === 'audio' ? Mic : c.type === 'hybrid' ? Sliders : Plug;
                return (
                  <Tooltip key={c.id}>
                    <TooltipTrigger asChild>
                      <button
                        disabled={readOnly}
                        onClick={() => addConsole(c)}
                        className="aspect-square rounded border border-border bg-background hover:bg-accent hover:border-primary flex flex-col items-center justify-center p-1.5 gap-1 text-center disabled:opacity-50"
                      >
                        <TypeIcon className="h-5 w-5 text-primary" />
                        <span className="text-[10px] font-medium leading-tight line-clamp-2">{c.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <div className="text-xs space-y-1">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-muted-foreground">{c.manufacturer}</div>
                        <div className="capitalize">Type : {c.type}</div>
                        {(c.dmxIn > 0 || c.dmxOut > 0) && (
                          <div className="flex items-center gap-1"><Plug className="h-3 w-3" /> DMX : {c.dmxIn} IN / {c.dmxOut} OUT</div>
                        )}
                        {c.audioIn > 0 && (
                          <div className="flex items-center gap-1"><Mic className="h-3 w-3" /> Audio IN : {c.audioIn}</div>
                        )}
                        {c.audioOut > 0 && (
                          <div className="flex items-center gap-1"><Headphones className="h-3 w-3" /> Audio OUT : {c.audioOut}</div>
                        )}
                        <div className="text-[10px] text-muted-foreground italic mt-1">{c.description}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {consoleLib.length === 0 && (
                <div className="col-span-2 text-[11px] text-muted-foreground italic">Chargement…</div>
              )}
            </div>
          )}

          {category === 'spot' && (
            <div className="grid grid-cols-2 gap-2">
              {fixtureLib.map((f, idx) => (
                <Tooltip key={`${f.manufacturer}-${f.name}-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      disabled={readOnly || !onAddSpotlight}
                      onClick={() => onAddSpotlight?.(f)}
                      className="aspect-square rounded border border-border bg-background hover:bg-accent hover:border-primary flex flex-col items-center justify-center p-1.5 gap-1 text-center disabled:opacity-50"
                    >
                      <Lightbulb className="h-5 w-5 text-primary" />
                      <span className="text-[10px] font-medium leading-tight line-clamp-2">{f.name}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <div className="font-semibold">{f.name}</div>
                      <div className="text-muted-foreground">{f.manufacturer}</div>
                      <div>{f.channels.length} canaux DMX</div>
                      <div className="text-[10px] text-muted-foreground">
                        {f.channels.map(c => c.name).join(', ')}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
              {fixtureLib.length === 0 && (
                <div className="col-span-2 text-[11px] text-muted-foreground italic">Chargement…</div>
              )}
            </div>
          )}

          {category === 'firework' && (
            <div className="grid grid-cols-2 gap-2">
              {fireworkLib.map((p, idx) => (
                <Tooltip key={`${p.reference}-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      disabled={readOnly || !onAddFirework}
                      onClick={() => onAddFirework?.(p, 'consumer')}
                      className="aspect-square rounded border border-border bg-background hover:bg-accent hover:border-primary flex flex-col items-center justify-center p-1.5 gap-1 text-center relative overflow-hidden disabled:opacity-50"
                      style={{ background: `linear-gradient(135deg, ${p.colors[0] || '#444'}22, transparent)` }}
                    >
                      <Sparkles className="h-5 w-5" style={{ color: p.colors[0] || 'currentColor' }} />
                      <span className="text-[10px] font-medium leading-tight line-clamp-2">{p.name}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <div className="text-xs space-y-1">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-muted-foreground">{p.manufacturer} · {p.reference}</div>
                      <div>{p.effectType} · {p.shots} coups · {p.duration}s</div>
                      <div>Calibre {p.caliber}mm · {p.firingPattern}</div>
                      <div className="flex gap-1 mt-1">
                        {p.colors.map((c, i) => <span key={i} className="w-3 h-3 rounded-full border border-border" style={{ background: c }} />)}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
              {fireworkLib.length === 0 && (
                <div className="col-span-2 text-[11px] text-muted-foreground italic">Chargement…</div>
              )}
            </div>
          )}

          {pendingFrom && !readOnly && (
            <div className="mt-3 p-2 rounded bg-amber-500/20 text-amber-200 text-[11px]">
              Câble en cours… clique un port compatible (même type, sens opposé).
            </div>
          )}
          {readOnly && (
            <div className="mt-3 p-2 rounded bg-muted text-muted-foreground text-[11px]">
              Mode rendu : câblage en lecture seule.
            </div>
          )}
        </div>
      </div>

      {/* Canvas wrapper (for sticky zoom controls) */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-auto"
          onClick={() => { onSelect(null); setPendingFrom(null); }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <div
            className="absolute top-0 left-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: 3000, height: 2000 }}
          >
            <svg className="absolute inset-0 pointer-events-none" width="3000" height="2000">
              {cables.map(cab => {
                const [fromKey, toKey] = cab.id.split('->');
                const a = getPortAbsolute(fromKey);
                const b = getPortAbsolute(toKey);
                if (!a || !b) return null;
                const { kind } = parsePortKey(fromKey);
                const stroke = kind === 'audio' ? 'hsl(142 71% 45%)' : 'hsl(var(--primary))';
                const mx = (a.x + b.x) / 2;
                return (
                  <g key={cab.id}>
                    <path
                      d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                      stroke={stroke}
                      strokeWidth={3}
                      fill="none"
                      className="opacity-80"
                    />
                    {!readOnly && (
                      <circle
                        cx={(a.x + b.x) / 2}
                        cy={(a.y + b.y) / 2}
                        r={8}
                        fill="hsl(var(--destructive))"
                        className="pointer-events-auto cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); removeCable(cab.id); }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Console nodes */}
            {consoles.map(c => {
              const pos = positions[c.id] || { x: 40, y: 40 };
              const s = c.spec;
              const h = consoleHeight(s);
              const TypeIcon = s.type === 'audio' ? Mic : s.type === 'hybrid' ? Sliders : Plug;

              // Build IN ports (left): dmx then audio
              const inPorts: { kind: PortKind; idx: number; label: string }[] = [];
              for (let i = 0; i < s.dmxIn; i++) inPorts.push({ kind: 'dmx', idx: i, label: `DMX IN ${i + 1}` });
              for (let i = 0; i < s.audioIn; i++) inPorts.push({ kind: 'audio', idx: i, label: `Audio IN ${i + 1}` });
              const outPorts: { kind: PortKind; idx: number; label: string }[] = [];
              for (let i = 0; i < s.dmxOut; i++) outPorts.push({ kind: 'dmx', idx: i, label: `DMX OUT ${i + 1}` });
              for (let i = 0; i < s.audioOut; i++) outPorts.push({ kind: 'audio', idx: i, label: `Audio OUT ${i + 1}` });

              const portRows = Math.max(inPorts.length, outPorts.length, 1);
              const nodeH = HEADER_H + 8 + portRows * PORT_ROW_H + 8;

              return (
                <div
                  key={c.id}
                  className="absolute rounded-lg border-2 bg-card shadow-md select-none border-primary"
                  style={{ left: pos.x, top: pos.y, width: NODE_W, height: nodeH }}
                  onPointerDown={(e) => onNodePointerDown(e, c.id)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-2 border-b border-border bg-primary/10 rounded-t-md" style={{ height: HEADER_H }}>
                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                      <TypeIcon className="h-3.5 w-3.5" /> {s.name}
                    </div>
                    {!readOnly && (
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); removeConsole(c.id); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="px-2 pt-1 text-[10px] text-muted-foreground truncate">{s.manufacturer}</div>
                  <div className="px-2 pb-1 text-[10px] text-muted-foreground space-y-0.5">
                    {(s.dmxIn + s.dmxOut > 0) && <div>DMX : {s.dmxIn}/{s.dmxOut}</div>}
                    {(s.audioIn + s.audioOut > 0) && <div>Audio : {s.audioIn}/{s.audioOut}</div>}
                  </div>

                  {inPorts.map(p => (
                    <PortButton key={`in-${p.kind}-${p.idx}`} nodeId={c.id} kind={p.kind} side="in" idx={inPorts.indexOf(p)} label={p.label} />
                  ))}
                  {outPorts.map(p => (
                    <PortButton key={`out-${p.kind}-${p.idx}`} nodeId={c.id} kind={p.kind} side="out" idx={outPorts.indexOf(p)} label={p.label} />
                  ))}
                </div>
              );
            })}

            {/* Spotlight nodes */}
            {spotlights.map(s => {
              const pos = positions[s.id] || { x: 360, y: 40 };
              const fx = s.spotlightFixture!;
              const color = s.properties.color;
              const isSelected = selectedObjectIds.includes(s.id);
              const inKey = buildPortKey(s.id, 'dmx', 'in', 0);
              const outKey = buildPortKey(s.id, 'dmx', 'out', 0);
              const pendingIn = pendingFrom === inKey;
              const pendingOut = pendingFrom === outKey;
              const isPending = pendingIn || pendingOut;
              const base = s.dmxAddress || 1;
              const lastChan = base + fx.channels.length - 1;
              const isConflict = conflicts.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`absolute rounded-lg border-2 bg-card shadow-md select-none ${
                    isPending ? 'border-amber-500 ring-2 ring-amber-500/50'
                    : isSelected ? 'border-primary ring-2 ring-primary/40'
                    : isConflict ? 'border-destructive'
                    : 'border-border'
                  }`}
                  style={{ left: pos.x, top: pos.y, width: NODE_W, height: FIXTURE_H }}
                  onPointerDown={(e) => onNodePointerDown(e, s.id)}
                  onClick={(e) => { e.stopPropagation(); onSelect(s.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }); }}
                >
                  <div className="flex items-center justify-between p-2 border-b border-border rounded-t-md">
                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                      <Lightbulb className="h-3.5 w-3.5" /> {s.name}
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <div className="w-full h-6 rounded transition-colors" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                    <div className="text-[10px] text-muted-foreground truncate">{fx.name}</div>
                    <div className={`text-[10px] font-mono ${isConflict ? 'text-destructive' : 'text-primary'}`}>
                      DMX {base}–{lastChan} {isConflict && '⚠'}
                    </div>
                  </div>
                  <button
                    disabled={!portClickable}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(inKey) : startCableFromPort(inKey); }}
                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${pendingIn ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    title="DMX IN"
                  >
                    <Plug className="h-3 w-3" />
                  </button>
                  <button
                    disabled={!portClickable}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(outKey) : startCableFromPort(outKey); }}
                    className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${pendingOut ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    title="DMX OUT (chaînage)"
                  >
                    <Plug className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {/* Firework nodes */}
            {fireworks.map(fw => {
              const pos = positions[fw.id] || { x: 360, y: 200 };
              const launchTime = fw.keyframes[0]?.time;
              const isFiring = launchTime !== undefined && currentTime >= launchTime && currentTime <= launchTime + FIRE_WINDOW_MS;
              const baseColor = fw.fireworkProduct?.colors[0] || fw.properties.color;
              const isSelected = selectedObjectIds.includes(fw.id);
              const inKey = buildPortKey(fw.id, 'dmx', 'in', 0);
              const isPending = pendingFrom === inKey;
              const isConflict = conflicts.has(fw.id);
              return (
                <div
                  key={fw.id}
                  className={`absolute rounded-lg border-2 bg-card shadow-md select-none ${
                    isPending ? 'border-amber-500 ring-2 ring-amber-500/50'
                    : isSelected ? 'border-primary ring-2 ring-primary/40'
                    : isConflict ? 'border-destructive'
                    : 'border-border'
                  }`}
                  style={{ left: pos.x, top: pos.y, width: NODE_W, height: FIXTURE_H }}
                  onPointerDown={(e) => onNodePointerDown(e, fw.id)}
                  onClick={(e) => { e.stopPropagation(); onSelect(fw.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }); }}
                >
                  <div className="flex items-center justify-between p-2 border-b border-border rounded-t-md">
                    <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                      <Sparkles className="h-3.5 w-3.5" /> {fw.name}
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    <div
                      className="w-full h-6 rounded flex items-center justify-center text-base transition-all"
                      style={{ backgroundColor: isFiring ? baseColor : 'hsl(var(--muted))', boxShadow: isFiring ? `0 0 16px ${baseColor}` : 'none' }}
                    >
                      {isFiring ? '💥' : '🎆'}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{fw.fireworkProduct?.manufacturer || ''}</div>
                    <div className={`text-[10px] font-mono ${isConflict ? 'text-destructive' : 'text-primary'}`}>
                      DMX {fw.dmxAddress ?? '—'} {isConflict && '⚠'}
                    </div>
                  </div>
                  <button
                    disabled={!portClickable}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(inKey) : startCableFromPort(inKey); }}
                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${isPending ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    title="DMX IN"
                  >
                    <Plug className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {(consoles.length === 0 && spotlights.length === 0 && fireworks.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground italic pointer-events-none">
                Ajoute une console, des projecteurs ou des feux d'artifice depuis la bibliothèque.
              </div>
            )}
          </div>
        </div>

        {/* Zoom controls — anchored to wrapper, immune to scroll */}
        <div className="absolute top-2 right-2 z-30 flex flex-col gap-1 bg-card/95 border border-border rounded p-1 shadow-md">
          <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(2, z * 1.1)); }} className="p-1 hover:bg-accent rounded" title="Zoom +">
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="text-[10px] text-center text-muted-foreground font-mono">{Math.round(zoom * 100)}%</div>
          <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.3, z * 0.9)); }} className="p-1 hover:bg-accent rounded" title="Zoom -">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setZoom(1); }} className="p-1 hover:bg-accent rounded" title="100%">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
};
