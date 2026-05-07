import React, { useState, useRef, useMemo, useEffect } from 'react';
import { EditorObject3D, SpotlightEditorObject } from '@/types/editor';
import { Lightbulb, Sparkles, Sliders, Plug, Trash2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogicalViewProps {
  spotlights: SpotlightEditorObject[];
  objects3D: EditorObject3D[];
  selectedObjectIds: string[];
  onSelect: (id: string | null, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  currentTime: number;
  getInterpolatedSpotlightChannels: (spot: SpotlightEditorObject, time: number) => number[];
  getSpotlightColor: (spot: SpotlightEditorObject, channels: number[]) => string;
}

// Window in ms during which a firework "fires" (visual flash)
const FIRE_WINDOW_MS = 600;

type NodeKind = 'console' | 'spot' | 'firework';
interface NodePos { x: number; y: number; }
interface ConsoleNode { id: string; name: string; outputs: number; }
interface DmxCable { id: string; from: string; to: string; }
type Category = 'console' | 'spot' | 'firework';

const NODE_W = 180;
const NODE_H = 120;

export const LogicalView: React.FC<LogicalViewProps> = ({
  spotlights,
  objects3D,
  selectedObjectIds,
  onSelect,
  currentTime,
  getInterpolatedSpotlightChannels,
  getSpotlightColor,
}) => {
  const fireworks = useMemo(() => objects3D.filter(o => o.type === 'firework'), [objects3D]);

  // Persistent (session) layout state
  const [consoles, setConsoles] = useState<ConsoleNode[]>([
    { id: 'console-1', name: 'Console DMX', outputs: 1 },
  ]);
  const [positions, setPositions] = useState<Record<string, NodePos>>({});
  const [cables, setCables] = useState<DmxCable[]>([]);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<Category>('console');
  const [zoom, setZoom] = useState(1);

  // Initialize positions for new nodes
  useEffect(() => {
    setPositions(prev => {
      const next = { ...prev };
      let changed = false;
      consoles.forEach((c, i) => {
        if (!next[c.id]) { next[c.id] = { x: 40, y: 40 + i * (NODE_H + 30) }; changed = true; }
      });
      spotlights.forEach((s, i) => {
        if (!next[s.id]) { next[s.id] = { x: 320 + (i % 3) * (NODE_W + 30), y: 40 + Math.floor(i / 3) * (NODE_H + 30) }; changed = true; }
      });
      fireworks.forEach((f, i) => {
        const row = Math.floor(i / 3);
        if (!next[f.id]) { next[f.id] = { x: 320 + (i % 3) * (NODE_W + 30), y: 40 + (Math.ceil(spotlights.length / 3) + row) * (NODE_H + 30) }; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [consoles, spotlights, fireworks]);

  // DMX conflict detection
  const conflicts = useMemo(() => {
    const used: Record<number, string[]> = {};
    spotlights.forEach(s => {
      for (let i = 0; i < s.fixture.channels.length; i++) {
        const a = s.dmxAddress + i;
        (used[a] ||= []).push(s.id);
      }
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
    if (pendingFrom) return; // cable mode
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[id];
    dragRef.current = { id, offX: e.clientX - rect.left - pos.x, offY: e.clientY - rect.top - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { id, offX, offY } = dragRef.current;
    setPositions(p => ({ ...p, [id]: { x: Math.max(0, e.clientX - rect.left - offX), y: Math.max(0, e.clientY - rect.top - offY) } }));
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Cable connect
  const startCableFrom = (id: string) => {
    setPendingFrom(prev => prev === id ? null : id);
  };
  const tryConnect = (toId: string) => {
    if (!pendingFrom || pendingFrom === toId) return;
    // Avoid duplicates
    setCables(prev => {
      if (prev.some(c => (c.from === pendingFrom && c.to === toId) || (c.from === toId && c.to === pendingFrom))) return prev;
      return [...prev, { id: `${pendingFrom}->${toId}`, from: pendingFrom!, to: toId }];
    });
    setPendingFrom(null);
  };
  const removeCable = (id: string) => setCables(prev => prev.filter(c => c.id !== id));

  const nodeById = (id: string) => {
    const c = consoles.find(x => x.id === id); if (c) return { kind: 'console' as const, c };
    const s = spotlights.find(x => x.id === id); if (s) return { kind: 'spot' as const, s };
    const f = fireworks.find(x => x.id === id); if (f) return { kind: 'firework' as const, f };
    return null;
  };

  const portCenter = (id: string) => {
    const p = positions[id];
    if (!p) return { x: 0, y: 0 };
    return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 };
  };

  // Cable endpoint: 'in' (left) or 'out' (right) of a node
  const portPoint = (id: string, side: 'in' | 'out') => {
    const p = positions[id];
    if (!p) return { x: 0, y: 0 };
    return { x: side === 'in' ? p.x : p.x + NODE_W, y: p.y + NODE_H / 2 };
  };

  // Cable id format: "<from>:<fromSide>-><to>:<toSide>"
  const parseCable = (cableFrom: string, cableTo: string, cableId: string) => {
    const [, fSide = 'out', tSide = 'in'] = cableId.match(/:(in|out)->.*:(in|out)$/) || [];
    return { fromSide: (fSide as 'in' | 'out') || 'out', toSide: (tSide as 'in' | 'out') || 'in' };
  };

  const startCableFromPort = (id: string, side: 'in' | 'out') => {
    const key = `${id}:${side}`;
    setPendingFrom(prev => prev === key ? null : key);
  };
  const tryConnectPort = (toId: string, toSide: 'in' | 'out') => {
    if (!pendingFrom) return;
    const [fromId, fromSide] = pendingFrom.split(':') as [string, 'in' | 'out'];
    if (fromId === toId) { setPendingFrom(null); return; }
    const cableId = `${fromId}:${fromSide}->${toId}:${toSide}`;
    setCables(prev => {
      if (prev.some(c => c.id === cableId)) return prev;
      return [...prev, { id: cableId, from: fromId, to: toId }];
    });
    setPendingFrom(null);
  };

  // Zoom with Ctrl+wheel
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  return (
    <div className="w-full h-full flex bg-muted/20">
      {/* Palette */}
      <div className="w-60 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-3 space-y-2 border-b border-border">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Catégories</div>
          <Button
            variant={category === 'console' ? 'default' : 'outline'}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setCategory('console')}
          >
            <Sliders className="h-4 w-4" /> Consoles DMX
          </Button>
          <Button
            variant={category === 'spot' ? 'default' : 'outline'}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setCategory('spot')}
          >
            <Lightbulb className="h-4 w-4" /> Projecteurs
          </Button>
          <Button
            variant={category === 'firework' ? 'default' : 'outline'}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setCategory('firework')}
          >
            <Sparkles className="h-4 w-4" /> Feux d'artifice
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              {category === 'console' ? 'Consoles' : category === 'spot' ? 'Projecteurs' : "Feux d'artifice"}
            </div>
            {category === 'console' && (
              <button
                onClick={() => setConsoles(prev => [...prev, { id: `console-${Date.now()}`, name: `Console ${prev.length + 1}`, outputs: 1 }])}
                className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                +
              </button>
            )}
          </div>
          {category === 'console' && consoles.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(null)}
              className="w-full text-left p-2 rounded border border-border bg-background hover:bg-accent text-xs flex items-center gap-2"
            >
              <Sliders className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {category === 'spot' && spotlights.map(s => (
            <button
              key={s.id}
              onClick={(e) => onSelect(s.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })}
              className={`w-full text-left p-2 rounded border text-xs flex items-center gap-2 ${
                selectedObjectIds.includes(s.id) ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{s.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">DMX {s.dmxAddress}</div>
              </div>
            </button>
          ))}
          {category === 'spot' && spotlights.length === 0 && (
            <div className="text-[11px] text-muted-foreground italic">Aucun projecteur.</div>
          )}
          {category === 'firework' && fireworks.map(f => (
            <button
              key={f.id}
              onClick={(e) => onSelect(f.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey })}
              className={`w-full text-left p-2 rounded border text-xs flex items-center gap-2 ${
                selectedObjectIds.includes(f.id) ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{f.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">DMX {f.dmxAddress ?? '—'}</div>
              </div>
            </button>
          ))}
          {category === 'firework' && fireworks.length === 0 && (
            <div className="text-[11px] text-muted-foreground italic">Aucun feu d'artifice.</div>
          )}
          {pendingFrom && (
            <div className="mt-3 p-2 rounded bg-amber-500/20 text-amber-200 text-[11px]">
              Câble en cours… clique un port cible (ou re-clique pour annuler).
            </div>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto"
        onClick={() => { onSelect(null); setPendingFrom(null); }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        {/* Zoom controls */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1 bg-card/90 border border-border rounded p-1 shadow">
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

        <div
          className="absolute top-0 left-0"
          style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: 3000, height: 2000 }}
        >
        {/* SVG cables */}
        <svg className="absolute inset-0 pointer-events-none" width="3000" height="2000">
          {cables.map(c => {
            const { fromSide, toSide } = parseCable(c.from, c.to, c.id);
            const a = portPoint(c.from, fromSide);
            const b = portPoint(c.to, toSide);
            const mx = (a.x + b.x) / 2;
            return (
              <g key={c.id}>
                <path
                  d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fill="none"
                  className="opacity-80"
                />
                <circle
                  cx={(a.x + b.x) / 2}
                  cy={(a.y + b.y) / 2}
                  r={8}
                  fill="hsl(var(--destructive))"
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); removeCable(c.id); }}
                />
              </g>
            );
          })}
        </svg>

        {/* Console nodes */}
        {consoles.map(c => {
          const pos = positions[c.id] || { x: 40, y: 40 };
          const isPending = pendingFrom?.startsWith(c.id + ':');
          return (
            <div
              key={c.id}
              className={`absolute rounded-lg border-2 bg-card shadow-md select-none ${isPending ? 'border-amber-500 ring-2 ring-amber-500/50' : 'border-primary'}`}
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
              onPointerDown={(e) => onNodePointerDown(e, c.id)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-2 border-b border-border bg-primary/10 rounded-t-md">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Sliders className="h-3.5 w-3.5" /> {c.name}
                </div>
                {consoles.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConsoles(prev => prev.filter(x => x.id !== c.id)); setCables(prev => prev.filter(cb => cb.from !== c.id && cb.to !== c.id)); }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="p-2 text-[11px] text-muted-foreground">
                Univers 1 · 512 canaux
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(c.id, 'out') : startCableFromPort(c.id, 'out'); }}
                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${isPending ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'}`}
                title="DMX OUT"
              >
                <Plug className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Spotlight nodes */}
        {spotlights.map(s => {
          const pos = positions[s.id] || { x: 320, y: 40 };
          const channels = getInterpolatedSpotlightChannels(s, currentTime);
          const color = getSpotlightColor(s, channels);
          const isSelected = selectedObjectIds.includes(s.id);
          const pendingIn = pendingFrom === `${s.id}:in`;
          const pendingOut = pendingFrom === `${s.id}:out`;
          const isPending = pendingIn || pendingOut;
          const lastChan = s.dmxAddress + s.fixture.channels.length - 1;
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
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
              onPointerDown={(e) => onNodePointerDown(e, s.id)}
              onClick={(e) => { e.stopPropagation(); onSelect(s.id, { ctrlKey: e.ctrlKey, shiftKey: e.shiftKey }); }}
            >
              <div className="flex items-center justify-between p-2 border-b border-border rounded-t-md">
                <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                  <Lightbulb className="h-3.5 w-3.5" /> {s.name}
                </div>
              </div>
              <div className="p-2 space-y-1">
                <div
                  className="w-full h-6 rounded transition-colors"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                />
                <div className="text-[10px] text-muted-foreground truncate">{s.fixture.name}</div>
                <div className={`text-[10px] font-mono ${isConflict ? 'text-destructive' : 'text-primary'}`}>
                  DMX {s.dmxAddress}–{lastChan} {isConflict && '⚠'}
                </div>
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(s.id, 'in') : startCableFromPort(s.id, 'in'); }}
                className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${pendingIn ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'}`}
                title="DMX IN"
              >
                <Plug className="h-3 w-3" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(s.id, 'out') : startCableFromPort(s.id, 'out'); }}
                className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${pendingOut ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'}`}
                title="DMX OUT (chaînage)"
              >
                <Plug className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {/* Firework nodes */}
        {fireworks.map(fw => {
          const pos = positions[fw.id] || { x: 320, y: 200 };
          const launchTime = fw.keyframes[0]?.time;
          const isFiring = launchTime !== undefined &&
            currentTime >= launchTime &&
            currentTime <= launchTime + FIRE_WINDOW_MS;
          const baseColor = fw.fireworkProduct?.colors[0] || fw.properties.color;
          const isSelected = selectedObjectIds.includes(fw.id);
          const isPending = pendingFrom === `${fw.id}:in`;
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
              style={{ left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }}
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
                  style={{
                    backgroundColor: isFiring ? baseColor : 'hsl(var(--muted))',
                    boxShadow: isFiring ? `0 0 16px ${baseColor}` : 'none',
                  }}
                >
                  {isFiring ? '💥' : '🎆'}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{fw.fireworkProduct?.manufacturer || ''}</div>
                <div className={`text-[10px] font-mono ${isConflict ? 'text-destructive' : 'text-primary'}`}>
                  DMX {fw.dmxAddress ?? '—'} {isConflict && '⚠'}
                </div>
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(fw.id, 'in') : startCableFromPort(fw.id, 'in'); }}
                className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${isPending ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'}`}
                title="DMX IN"
              >
                <Plug className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        {(spotlights.length === 0 && fireworks.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground italic pointer-events-none">
            Ajoute des projecteurs ou des feux d'artifice pour les câbler.
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
