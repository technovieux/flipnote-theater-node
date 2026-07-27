import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EditorObject3D, Object3DProperties } from '@/types/editor';

interface KeystoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projector: EditorObject3D | null;
  onUpdateProperties: (properties: Partial<Object3DProperties>) => void;
}

type Corner = 'TL' | 'TR' | 'BR' | 'BL';

/**
 * Interactive 4-corner keystone editor.
 * The user drags any of the 4 corners of a rectangle to compensate for
 * the video projection surface distortion.
 *
 * Corner offsets are stored as normalized (-0.5 .. 0.5) values.
 */
export const KeystoneDialog: React.FC<KeystoneDialogProps> = ({ open, onOpenChange, projector, onUpdateProperties }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<Corner | null>(null);

  const size = 360;
  const inset = 40;

  const props = projector?.properties;
  const corners: Record<Corner, { x: number; y: number }> = {
    TL: props?.keystoneTL ?? { x: 0, y: 0 },
    TR: props?.keystoneTR ?? { x: 0, y: 0 },
    BR: props?.keystoneBR ?? { x: 0, y: 0 },
    BL: props?.keystoneBL ?? { x: 0, y: 0 },
  };

  const base: Record<Corner, { x: number; y: number }> = {
    TL: { x: inset, y: inset },
    TR: { x: size - inset, y: inset },
    BR: { x: size - inset, y: size - inset },
    BL: { x: inset, y: size - inset },
  };

  const w = size - inset * 2;
  const h = size - inset * 2;

  const screen = (c: Corner) => ({
    x: base[c].x + corners[c].x * w,
    y: base[c].y - corners[c].y * h, // y up in normalized space, y down in svg
  });

  const path = () => {
    const p = ['TL', 'TR', 'BR', 'BL'].map((c) => screen(c as Corner));
    return `M${p[0].x},${p[0].y} L${p[1].x},${p[1].y} L${p[2].x},${p[2].y} L${p[3].x},${p[3].y} Z`;
  };

  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * size;
    const sy = ((e.clientY - rect.top) / rect.height) * size;
    const c = dragging.current;
    const nx = Math.max(-0.5, Math.min(0.5, (sx - base[c].x) / w));
    const ny = Math.max(-0.5, Math.min(0.5, -(sy - base[c].y) / h));
    const key = `keystone${c}` as 'keystoneTL' | 'keystoneTR' | 'keystoneBR' | 'keystoneBL';
    onUpdateProperties({ [key]: { x: nx, y: ny } } as Partial<Object3DProperties>);
  };

  const reset = () => {
    onUpdateProperties({
      keystoneTL: { x: 0, y: 0 },
      keystoneTR: { x: 0, y: 0 },
      keystoneBR: { x: 0, y: 0 },
      keystoneBL: { x: 0, y: 0 },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keystone — {projector?.name ?? 'Projecteur'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2">
          <svg
            ref={svgRef}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="bg-black/40 rounded border border-border touch-none"
            onMouseMove={onMove}
            onMouseUp={() => (dragging.current = null)}
            onMouseLeave={() => (dragging.current = null)}
          >
            {/* Reference rectangle */}
            <rect x={inset} y={inset} width={w} height={h} fill="none" stroke="#333" strokeDasharray="4 4" />
            {/* Deformed quad */}
            <path d={path()} fill="rgba(0,212,255,0.15)" stroke="#00d4ff" strokeWidth={2} />
            {(['TL', 'TR', 'BR', 'BL'] as Corner[]).map((c) => {
              const s = screen(c);
              return (
                <circle
                  key={c}
                  cx={s.x}
                  cy={s.y}
                  r={9}
                  fill="#00d4ff"
                  stroke="white"
                  strokeWidth={2}
                  style={{ cursor: 'grab' }}
                  onMouseDown={(e) => { e.preventDefault(); dragging.current = c; }}
                />
              );
            })}
          </svg>
          <p className="text-xs text-muted-foreground">Faites glisser les 4 coins pour adapter l'image à la surface.</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={reset}>Réinitialiser</Button>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};