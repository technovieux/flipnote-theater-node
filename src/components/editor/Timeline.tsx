import React, { useRef, useState, useCallback, useEffect } from 'react';
import { EditorObject, EditorObject3D, Scene, AudioTrack } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square, RotateCcw, Plus, ZoomIn, ZoomOut, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface TimelineProps {
  objects: EditorObject[];
  objects3D: EditorObject3D[];
  mode3D: boolean;
  scenes: Scene[];
  audioTrack: AudioTrack | null;
  selectedObjectIds: string[];
  selectedKeyframe: { objectId: string; keyframeIndex: number } | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onAddScene: (name: string) => void;
  onMoveScene?: (sceneId: string, newTime: number) => void;
  onDeleteScene?: (sceneId: string) => void;
  selectedSceneId?: string | null;
  onSelectScene?: (sceneId: string | null) => void;
  onSelectObject: (id: string) => void;
  onSelectKeyframe: (objectId: string, keyframeIndex: number) => void;
  onMoveKeyframe?: (objectId: string, keyframeIndex: number, newTime: number) => void;
  onDeleteKeyframe?: (objectId: string, keyframeIndex: number) => void;
  renderMode?: boolean;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

const BASE_PIXELS_PER_SECOND = 50;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export const Timeline: React.FC<TimelineProps> = ({
  objects,
  objects3D,
  mode3D,
  scenes,
  audioTrack,
  selectedObjectIds,
  selectedKeyframe,
  currentTime,
  duration,
  isPlaying,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onAddScene,
  onMoveScene,
  onDeleteScene,
  selectedSceneId,
  onSelectScene,
  onSelectObject,
  onSelectKeyframe,
  onMoveKeyframe,
  onDeleteKeyframe,
  renderMode = false,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [sceneDialogOpen, setSceneDialogOpen] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [zoom, setZoom] = useState(1);
  const [draggingKeyframe, setDraggingKeyframe] = useState<{
    objectId: string;
    keyframeIndex: number;
    startX: number;
    startTime: number;
  } | null>(null);
  const [draggingScene, setDraggingScene] = useState<{
    sceneId: string;
    startX: number;
    startTime: number;
  } | null>(null);

  // Create audio element when audioTrack changes
  useEffect(() => {
    if (audioTrack?.file) {
      // Cleanup old URL
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      
      const url = URL.createObjectURL(audioTrack.file);
      audioUrlRef.current = url;
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      return () => {
        audio.pause();
        URL.revokeObjectURL(url);
      };
    }
  }, [audioTrack?.file]);

  // Sync audio playback with timeline
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.currentTime = currentTime / 1000;
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Sync audio position when seeking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying) return;
    
    audio.currentTime = currentTime / 1000;
  }, [currentTime, isPlaying]);
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * zoom;
  const totalWidth = (duration / 1000) * pixelsPerSecond;

  // Calculate audio waveform width based on audio duration
  const audioWidth = audioTrack ? (audioTrack.duration / 1000) * pixelsPerSecond : 0;
  const getMarkerInterval = () => {
    if (zoom < 0.2) return 60000; // 1 minute
    if (zoom < 0.5) return 30000; // 30 seconds
    if (zoom < 1) return 10000; // 10 seconds
    if (zoom < 2) return 5000; // 5 seconds
    return 1000; // 1 second
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const x = e.clientX - rect.left + scrollLeft;
    const time = (x / pixelsPerSecond) * 1000;
    onSeek(Math.max(0, Math.min(time, duration)));
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
    }
  }, []);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(MAX_ZOOM, prev + 0.2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(MIN_ZOOM, prev - 0.2));
  };

  const handleAddScene = () => {
    if (newSceneName.trim()) {
      onAddScene(newSceneName.trim());
      setNewSceneName('');
      setSceneDialogOpen(false);
    }
  };

  // Keyframe drag handlers
  const handleKeyframeMouseDown = (
    e: React.MouseEvent,
    objectId: string,
    keyframeIndex: number,
    keyframeTime: number
  ) => {
    e.stopPropagation();
    setDraggingKeyframe({
      objectId,
      keyframeIndex,
      startX: e.clientX,
      startTime: keyframeTime,
    });
  };

  const handleKeyframeDoubleClick = (
    e: React.MouseEvent,
    objectId: string,
    keyframeTime: number
  ) => {
    e.stopPropagation();
    onSelectObject(objectId);
    onSeek(keyframeTime);
  };

  const handleKeyframeClick = (
    e: React.MouseEvent,
    objectId: string,
    keyframeIndex: number
  ) => {
    e.stopPropagation();
    onSelectKeyframe(objectId, keyframeIndex);
  };

  useEffect(() => {
    if (!draggingKeyframe) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingKeyframe) return;
      
      const deltaX = e.clientX - draggingKeyframe.startX;
      const deltaTime = (deltaX / pixelsPerSecond) * 1000;
      const newTime = Math.max(0, Math.min(duration, draggingKeyframe.startTime + deltaTime));
      
      if (onMoveKeyframe) {
        onMoveKeyframe(draggingKeyframe.objectId, draggingKeyframe.keyframeIndex, newTime);
      }
    };

    const handleMouseUp = () => {
      setDraggingKeyframe(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingKeyframe, pixelsPerSecond, duration, onMoveKeyframe]);

  // Scene drag effect
  useEffect(() => {
    if (!draggingScene) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingScene) return;
      const deltaX = e.clientX - draggingScene.startX;
      const deltaTime = (deltaX / pixelsPerSecond) * 1000;
      const newTime = Math.max(0, Math.min(duration, draggingScene.startTime + deltaTime));
      if (onMoveScene) {
        onMoveScene(draggingScene.sceneId, newTime);
      }
    };

    const handleMouseUp = () => {
      setDraggingScene(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingScene, pixelsPerSecond, duration, onMoveScene]);

  const cursorPosition = (currentTime / 1000) * pixelsPerSecond;

  // Generate time markers based on zoom level
  const markerInterval = getMarkerInterval();
  const markers = [];
  for (let t = 0; t <= duration; t += markerInterval) {
    markers.push(t);
  }

  const isAtStart = currentTime === 0;
  const showStopAsReset = !isPlaying && !isAtStart;

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header flex items-center justify-between">
        <span>Timeline</span>
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <Button size="sm" variant="secondary" onClick={onPause} className="transport-btn transport-btn-primary">
              <Pause className="h-3 w-3 mr-1" /> Pause
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={onPlay} className="transport-btn transport-btn-primary">
              <Play className="h-3 w-3 mr-1" /> Play
            </Button>
          )}
          
          {(isPlaying || !isAtStart) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onStop}
              className="transport-btn transport-btn-secondary"
            >
              {showStopAsReset ? (
                <><RotateCcw className="h-3 w-3 mr-1" /> Reset</>
              ) : (
                <><Square className="h-3 w-3 mr-1" /> Stop</>
              )}
            </Button>
          )}
          
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSceneDialogOpen(true)}
            className="transport-btn transport-btn-primary"
          >
            <Plus className="h-3 w-3 mr-1" /> Ajouter Scène
          </Button>

          <div className="flex items-center gap-1 ml-2 border-l border-panel-border pl-2">
            <Button size="sm" variant="ghost" onClick={handleZoomOut} className="h-6 w-6 p-0">
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="sm" variant="ghost" onClick={handleZoomIn} className="h-6 w-6 p-0">
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
          
          <span className="text-sm font-mono ml-4">{formatTime(currentTime)}</span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden" onWheel={handleWheel}>
        {/* Track labels */}
        <div className="flex border-b border-panel-border">
          <div className="w-32 flex-shrink-0 border-r border-panel-border" />
          <div
            ref={timelineRef}
            className="flex-1 timeline-scroll relative overflow-x-auto"
            onClick={handleTimelineClick}
          >
            {/* Time ruler */}
            <div className="h-6 relative bg-timeline-bg" style={{ width: totalWidth }}>
              {markers.map((t) => (
                <div
                  key={t}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: (t / 1000) * pixelsPerSecond }}
                >
                  <div className="h-2 w-px bg-timeline-line" />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(t).substring(0, 8)}
                  </span>
                </div>
              ))}
              {/* Cursor */}
              <div
                className="absolute top-0 h-full w-px bg-timeline-cursor z-10"
                style={{ left: cursorPosition }}
              >
                <div className="w-3 h-3 bg-timeline-cursor -translate-x-1/2 rotate-45 -translate-y-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-auto">
          <div className="flex flex-col">
            {/* Scenes track */}
            <div className="flex border-b border-panel-border">
              <div className="w-32 flex-shrink-0 px-2 py-1 text-sm bg-keyframe-scene/20 border-r border-panel-border font-medium">
                Scènes
              </div>
              <div
                className="flex-1 timeline-track bg-timeline-bg relative overflow-x-auto"
                style={{ width: totalWidth }}
              >
                {scenes.map((scene) => {
                  const isDragging = draggingScene?.sceneId === scene.id;
                  return (
                    <HoverCard key={scene.id} openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div
                          className={`keyframe-diamond bg-keyframe-scene cursor-grab ${
                            isDragging ? 'ring-2 ring-white scale-125' : ''
                          }`}
                          style={{ left: (scene.time / 1000) * pixelsPerSecond - 6 }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingScene({
                              sceneId: scene.id,
                              startX: e.clientX,
                              startTime: scene.time,
                            });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            onSeek(scene.time);
                          }}
                        />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-52 p-2 text-xs" side="top">
                        <div className="font-semibold mb-1">Scène {scene.number}</div>
                        <div className="text-foreground mb-1">{scene.name}</div>
                        <div className="text-muted-foreground mb-2">{formatTime(scene.time)}</div>
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <span className="text-muted-foreground text-[10px]">Double-clic pour aller à • Glisser pour déplacer</span>
                          {onDeleteScene && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteScene(scene.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
              </div>
            </div>

            {/* Object tracks - 2D */}
            {!renderMode && !mode3D && objects.map((obj) => (
              <div
                key={obj.id}
                className={`flex border-b border-panel-border cursor-pointer ${
                  selectedObjectIds.includes(obj.id) ? 'bg-primary/10' : ''
                }`}
                onClick={() => onSelectObject(obj.id)}
              >
                <div className="w-32 flex-shrink-0 px-2 py-1 text-sm truncate border-r border-panel-border flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: obj.properties.color }}
                  />
                  {obj.name}
                </div>
                <div
                  className="flex-1 timeline-track bg-timeline-bg relative overflow-x-auto"
                  style={{ width: totalWidth }}
                >
                  {obj.keyframes.map((kf, idx) => {
                    const isSelected = selectedKeyframe?.objectId === obj.id && selectedKeyframe?.keyframeIndex === idx;
                    const isDragging = draggingKeyframe?.objectId === obj.id && draggingKeyframe?.keyframeIndex === idx;
                    
                    return (
                      <HoverCard key={idx} openDelay={300} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div
                            className={`keyframe-circle cursor-grab ${
                              isDragging ? 'ring-2 ring-white scale-125' : ''
                            } ${isSelected ? 'ring-2 ring-primary scale-110' : ''}`}
                            style={{
                              left: (kf.time / 1000) * pixelsPerSecond - 6,
                              backgroundColor: kf.properties.color,
                            }}
                            onClick={(e) => handleKeyframeClick(e, obj.id, idx)}
                            onMouseDown={(e) => handleKeyframeMouseDown(e, obj.id, idx, kf.time)}
                            onDoubleClick={(e) => handleKeyframeDoubleClick(e, obj.id, kf.time)}
                          />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-48 p-2 text-xs" side="top">
                          <div className="font-semibold mb-1">{obj.name}</div>
                          <div className="text-muted-foreground mb-2">{formatTime(kf.time)}</div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span>Position:</span>
                              <span>{Math.round(kf.properties.x)}, {Math.round(kf.properties.y)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Taille:</span>
                              <span>{Math.round(kf.properties.width)} × {Math.round(kf.properties.height)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Rotation:</span>
                              <span>{Math.round(kf.properties.rotation)}°</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Opacité:</span>
                              <span>{Math.round(kf.properties.opacity)}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Couleur:</span>
                              <div className="flex items-center gap-1">
                                <div 
                                  className="w-3 h-3 rounded-sm border border-border" 
                                  style={{ backgroundColor: kf.properties.color }}
                                />
                                <span>{kf.properties.color}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-muted-foreground text-[10px]">Double-clic pour éditer</span>
                            {onDeleteKeyframe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteKeyframe(obj.id, idx);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Object tracks - 3D */}
            {!renderMode && mode3D && objects3D.map((obj) => (
              <div
                key={obj.id}
                className={`flex border-b border-panel-border cursor-pointer ${
                  selectedObjectIds.includes(obj.id) ? 'bg-primary/10' : ''
                }`}
                onClick={() => onSelectObject(obj.id)}
              >
                <div className="w-32 flex-shrink-0 px-2 py-1 text-sm truncate border-r border-panel-border flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: obj.properties.color }}
                  />
                  {obj.name}
                </div>
                <div
                  className="flex-1 timeline-track bg-timeline-bg relative overflow-x-auto"
                  style={{ width: totalWidth }}
                >
                  {obj.keyframes.map((kf, idx) => {
                    const isSelected = selectedKeyframe?.objectId === obj.id && selectedKeyframe?.keyframeIndex === idx;
                    const isDragging = draggingKeyframe?.objectId === obj.id && draggingKeyframe?.keyframeIndex === idx;
                    
                    return (
                      <HoverCard key={idx} openDelay={300} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div
                            className={`keyframe-circle cursor-grab ${
                              isDragging ? 'ring-2 ring-white scale-125' : ''
                            } ${isSelected ? 'ring-2 ring-primary scale-110' : ''}`}
                            style={{
                              left: (kf.time / 1000) * pixelsPerSecond - 6,
                              backgroundColor: kf.properties.color,
                            }}
                            onClick={(e) => handleKeyframeClick(e, obj.id, idx)}
                            onMouseDown={(e) => handleKeyframeMouseDown(e, obj.id, idx, kf.time)}
                            onDoubleClick={(e) => handleKeyframeDoubleClick(e, obj.id, kf.time)}
                          />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-56 p-2 text-xs" side="top">
                          <div className="font-semibold mb-1">{obj.name}</div>
                          <div className="text-muted-foreground mb-2">{formatTime(kf.time)}</div>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span>Position:</span>
                              <span>{Math.round(kf.properties.x)}, {Math.round(kf.properties.y)}, {Math.round(kf.properties.z)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Taille:</span>
                              <span>{Math.round(kf.properties.width)} × {Math.round(kf.properties.height)} × {Math.round(kf.properties.depth)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Rotation:</span>
                              <span>{Math.round(kf.properties.rotationX)}° / {Math.round(kf.properties.rotationY)}° / {Math.round(kf.properties.rotationZ)}°</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Opacité:</span>
                              <span>{Math.round(kf.properties.opacity)}%</span>
                            </div>
                            {kf.camera && (
                              <div className="flex justify-between">
                                <span>Caméra:</span>
                                <span className="text-primary">✓ Sauvegardée</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span>Couleur:</span>
                              <div className="flex items-center gap-1">
                                <div 
                                  className="w-3 h-3 rounded-sm border border-border" 
                                  style={{ backgroundColor: kf.properties.color }}
                                />
                                <span>{kf.properties.color}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-muted-foreground text-[10px]">Double-clic pour éditer</span>
                            {onDeleteKeyframe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteKeyframe(obj.id, idx);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Audio track */}
            <div className="flex border-b border-panel-border">
              <div className="w-32 flex-shrink-0 px-2 py-1 text-sm text-muted-foreground border-r border-panel-border">
                Audio {audioTrack && <span className="text-xs">({audioTrack.name})</span>}
              </div>
              <div
                className="flex-1 timeline-track bg-timeline-bg overflow-x-auto relative h-8"
                style={{ width: totalWidth }}
              >
                {audioTrack && audioTrack.waveform.length > 0 && (
                  <svg
                    className="absolute top-0 left-0 h-full"
                    style={{ width: audioWidth }}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="waveformGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                      </linearGradient>
                    </defs>
                    {audioTrack.waveform.map((value, index) => {
                      const barWidth = audioWidth / audioTrack.waveform.length;
                      const barHeight = Math.max(2, value * 100);
                      return (
                        <rect
                          key={index}
                          x={index * barWidth}
                          y={(32 - barHeight) / 2}
                          width={Math.max(1, barWidth - 1)}
                          height={barHeight}
                          fill="url(#waveformGradient)"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={sceneDialogOpen} onOpenChange={setSceneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle Scène</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nom de la scène"
            value={newSceneName}
            onChange={(e) => setNewSceneName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddScene()}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSceneDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddScene}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
