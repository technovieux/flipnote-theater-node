import React, { useState, useRef, useMemo, useEffect } from 'react';
import { EditorObject3D, SpotlightEditorObject } from '@/types/editor';
import { Lightbulb, Sparkles, Sliders, Plug, Trash2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpotlightFixture } from '@/types/spotlight';
import { FireworkProduct, FireworkCategory } from '@/types/fireworks';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LogicalViewProps {
  spotlights: SpotlightEditorObject[];
  objects3D: EditorObject3D[];
  selectedObjectIds: string[];
  onSelect: (id: string | null, options?: { ctrlKey?: boolean; shiftKey?: boolean }) => void;
  currentTime: number;
  getInterpolatedSpotlightChannels: (spot: SpotlightEditorObject, time: number) => number[];
  getSpotlightColor: (spot: SpotlightEditorObject, channels: number[]) => string;
  onAddSpotlight?: (fixture: SpotlightFixture) => void;
  onAddFirework?: (product: FireworkProduct, category: FireworkCategory) => void;
  readOnly?: boolean;
}

const FIRE_WINDOW_MS = 600;

interface NodePos { x: number; y: number; }
interface ConsoleNode { id: string; name: string; outputs: number; }
interface DmxCable { id: string; from: string; to: string; }
type Category = 'console' | 'spot' | 'firework';
type PortSide = 'in' | 'out';

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
  onAddSpotlight,
  onAddFirework,
  readOnly = false,
}) => {
  const fireworks = useMemo(() => objects3D.filter(o => o.type === 'firework'), [objects3D]);

  const [consoles, setConsoles] = useState<ConsoleNode[]>([
    { id: 'console-1', name: 'Console DMX', outputs: 1 },
  ]);
  const [positions, setPositions] = useState<Record<string, NodePos>>({});
  const [cables, setCables] = useState<DmxCable[]>([]);
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<Category>('console');
  const [zoom, setZoom] = useState(1);

  // Library data
  const [fixtureLib, setFixtureLib] = useState<SpotlightFixture[]>([]);
  const [fireworkLib, setFireworkLib] = useState<FireworkProduct[]>([]);

  useEffect(() => {
    if (category === 'spot' && fixtureLib.length === 0) {
      fetch('/data/spotlight_fixtures.json').then(r => r.json()).then(setFixtureLib).catch(console.error);
    }
    if (category === 'firework' && fireworkLib.length === 0) {
      fetch('/data/consumer_fireworks.json').then(r => r.json()).then(setFireworkLib).catch(console.error);
    }
  }, [category, fixtureLib.length, fireworkLib.length]);

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
    if (readOnly) return;
    if (pendingFrom) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = positions[id];
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

  const portPoint = (id: string, side: PortSide) => {
    const p = positions[id];
    if (!p) return { x: 0, y: 0 };
    return { x: side === 'in' ? p.x : p.x + NODE_W, y: p.y + NODE_H / 2 };
  };

  const parseCable = (cableId: string) => {
    const m = cableId.match(/:(in|out)->.*:(in|out)$/);
    return { fromSide: (m?.[1] as PortSide) || 'out', toSide: (m?.[2] as PortSide) || 'in' };
  };

  const startCableFromPort = (id: string, side: PortSide) => {
    if (readOnly) return;
    const key = `${id}:${side}`;
    setPendingFrom(prev => prev === key ? null : key);
  };
  const tryConnectPort = (toId: string, toSide: PortSide) => {
    if (readOnly || !pendingFrom) return;
    const [fromId, fromSide] = pendingFrom.split(':') as [string, PortSide];
    if (fromId === toId) { setPendingFrom(null); return; }
    // Disallow same-direction port connections (in↔in or out↔out)
    if (fromSide === toSide) { setPendingFrom(null); return; }
    const cableId = `${fromId}:${fromSide}->${toId}:${toSide}`;
    setCables(prev => prev.some(c => c.id === cableId) ? prev : [...prev, { id: cableId, from: fromId, to: toId }]);
    setPendingFrom(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z * (e.deltaY < 0 ? 1.1 : 0.9))));
  };

  const portClickable = !readOnly;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="w-full h-full flex bg-muted/20">
      {/* Palette */}
      <div className="w-64 border-r border-border bg-card flex flex-col overflow-hidden">
        <div className="p-3 space-y-2 border-b border-border">
          <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Catégories</div>
          <Button variant={category === 'console' ? 'default' : 'outline'} size="sm" className="w-full justify-start gap-2" onClick={() => setCategory('console')}>
            <Sliders className="h-4 w-4" /> Consoles DMX
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
            {category === 'console' ? 'Consoles' : category === 'spot' ? 'Bibliothèque projecteurs' : "Bibliothèque feux"}
          </div>

          {category === 'console' && (
            <div className="grid grid-cols-2 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    disabled={readOnly}
                    onClick={() => setConsoles(prev => [...prev, { id: `console-${Date.now()}`, name: `Console ${prev.length + 1}`, outputs: 1 }])}
                    className="aspect-square rounded border border-dashed border-primary/60 bg-background hover:bg-primary/10 flex flex-col items-center justify-center text-[10px] gap-1 disabled:opacity-50"
                  >
                    <Sliders className="h-5 w-5 text-primary" />
                    <span className="font-medium">+ Console</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs">
                    <div className="font-semibold">Console DMX</div>
                    <div className="text-muted-foreground">1 univers · 512 canaux</div>
                  </div>
                </TooltipContent>
              </Tooltip>
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
              Câble en cours… clique un port cible compatible (IN↔OUT).
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
              {cables.map(c => {
                const { fromSide, toSide } = parseCable(c.id);
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
                    {!readOnly && (
                      <circle
                        cx={(a.x + b.x) / 2}
                        cy={(a.y + b.y) / 2}
                        r={8}
                        fill="hsl(var(--destructive))"
                        className="pointer-events-auto cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); removeCable(c.id); }}
                      />
                    )}
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
                    {consoles.length > 1 && !readOnly && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConsoles(prev => prev.filter(x => x.id !== c.id)); setCables(prev => prev.filter(cb => cb.from !== c.id && cb.to !== c.id)); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="p-2 text-[11px] text-muted-foreground">Univers 1 · 512 canaux</div>
                  <button
                    disabled={!portClickable}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(c.id, 'out') : startCableFromPort(c.id, 'out'); }}
                    className={`absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${isPending ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'} disabled:opacity-60 disabled:cursor-not-allowed`}
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
                    <div className="w-full h-6 rounded transition-colors" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                    <div className="text-[10px] text-muted-foreground truncate">{s.fixture.name}</div>
                    <div className={`text-[10px] font-mono ${isConflict ? 'text-destructive' : 'text-primary'}`}>
                      DMX {s.dmxAddress}–{lastChan} {isConflict && '⚠'}
                    </div>
                  </div>
                  <button
                    disabled={!portClickable}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(s.id, 'in') : startCableFromPort(s.id, 'in'); }}
                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${pendingIn ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    title="DMX IN"
                  >
                    <Plug className="h-3 w-3" />
                  </button>
                  <button
                    disabled={!portClickable}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(s.id, 'out') : startCableFromPort(s.id, 'out'); }}
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
              const pos = positions[fw.id] || { x: 320, y: 200 };
              const launchTime = fw.keyframes[0]?.time;
              const isFiring = launchTime !== undefined && currentTime >= launchTime && currentTime <= launchTime + FIRE_WINDOW_MS;
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
                    onClick={(e) => { e.stopPropagation(); pendingFrom ? tryConnectPort(fw.id, 'in') : startCableFromPort(fw.id, 'in'); }}
                    className={`absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card hover:bg-primary hover:text-primary-foreground transition ${isPending ? 'border-amber-500 bg-amber-500 text-black' : 'border-primary'} disabled:opacity-60 disabled:cursor-not-allowed`}
                    title="DMX IN"
                  >
                    <Plug className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {(spotlights.length === 0 && fireworks.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground italic pointer-events-none">
                Ajoute des projecteurs ou des feux d'artifice depuis la bibliothèque.
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
