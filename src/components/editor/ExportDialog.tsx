import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditorState } from '@/types/editor';
import {
  ExportOptions,
  renderSceneAsync,
  exportAsImageSequence,
  exportAsVideo,
  exportAsPDF,
  getAllKeyframeTimes,
  formatTimecode,
} from '@/lib/exportUtils';
import { Progress } from '@/components/ui/progress';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: EditorState;
}

type ExportType = 'images' | 'video' | 'pdf';
type ImageFormat = 'jpg' | 'png' | 'webp';
type VideoFormat = 'webm' | 'mp4';

export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onOpenChange,
  state,
}) => {
  const [exportType, setExportType] = useState<ExportType>('images');
  const [imageFormat, setImageFormat] = useState<ImageFormat>('jpg');
  const [videoFormat, setVideoFormat] = useState<VideoFormat>('mp4');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [showRemarks, setShowRemarks] = useState(true);
  const [showInfos, setShowInfos] = useState(true);
  const [remarksHeight, setRemarksHeight] = useState(20);
  const [infosWidth, setInfosWidth] = useState(25);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Generate preview
  useEffect(() => {
    if (!open) return;

    const generatePreview = async () => {
      const keyframeTimes = getAllKeyframeTimes(state);
      const previewTime = keyframeTimes[0] || 0;
      const canvas = await renderSceneAsync(
        state,
        previewTime,
        backgroundColor,
        exportType !== 'video'
      );

      // Scale down for preview
      const previewCanvas = document.createElement('canvas');
      const scale = 300 / canvas.width;
      previewCanvas.width = 300;
      previewCanvas.height = canvas.height * scale;

      const ctx = previewCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);

      setPreviewUrl(previewCanvas.toDataURL());
    };

    generatePreview();
  }, [open, state, backgroundColor, exportType]);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress({ current: 0, total: 1 });

    const options: ExportOptions = {
      type: exportType,
      format: imageFormat,
      videoFormat,
      backgroundColor,
      showRemarks,
      showInfos,
      remarksHeight,
      infosWidth,
    };

    const onProgress = (current: number, total: number) => {
      setProgress({ current, total });
    };

    try {
      switch (exportType) {
        case 'images':
          await exportAsImageSequence(state, options, onProgress);
          break;
        case 'video':
          await exportAsVideo(state, options, onProgress);
          break;
        case 'pdf':
          await exportAsPDF(state, options, onProgress);
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const getTypeLabel = (type: ExportType) => {
    switch (type) {
      case 'images':
        return 'image';
      case 'video':
        return 'video';
      case 'pdf':
        return 'doc';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] bg-card">
        <DialogHeader>
          <DialogTitle>Exporter</DialogTitle>
        </DialogHeader>

        <div className="flex gap-6">
          {/* Left panel - Options */}
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <Label>exporter en :</Label>
              <Select
                value={exportType}
                onValueChange={(v) => setExportType(v as ExportType)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="images">image</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="pdf">doc</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>extension :</Label>
              {exportType === 'images' && (
                <Select
                  value={imageFormat}
                  onValueChange={(v) => setImageFormat(v as ImageFormat)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpg">jpg</SelectItem>
                    <SelectItem value="png">png</SelectItem>
                    <SelectItem value="webp">webp</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {exportType === 'video' && (
                <Select
                  value={videoFormat}
                  onValueChange={(v) => setVideoFormat(v as VideoFormat)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp4">mp4</SelectItem>
                    <SelectItem value="webm">webm</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {exportType === 'pdf' && (
                <Select value="pdf" disabled>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">pdf</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>fond :</Label>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-20 h-8 cursor-pointer border border-border rounded"
              />
            </div>

            {exportType === 'pdf' && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="infos"
                    checked={showInfos}
                    onCheckedChange={(checked) => setShowInfos(checked === true)}
                  />
                  <Label htmlFor="infos">espace "infos"</Label>
                </div>

                {showInfos && (
                  <div className="space-y-2">
                    <Label>Largeur infos: {infosWidth}%</Label>
                    <Slider
                      value={[infosWidth]}
                      onValueChange={(v) => setInfosWidth(v[0])}
                      min={15}
                      max={40}
                      step={5}
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remarks"
                    checked={showRemarks}
                    onCheckedChange={(checked) => setShowRemarks(checked === true)}
                  />
                  <Label htmlFor="remarks">espace "remarques"</Label>
                </div>

                {showRemarks && (
                  <div className="space-y-2">
                    <Label>Hauteur remarques: {remarksHeight}%</Label>
                    <Slider
                      value={[remarksHeight]}
                      onValueChange={(v) => setRemarksHeight(v[0])}
                      min={10}
                      max={40}
                      step={5}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel - Preview */}
          <div className="flex-1">
            <div className="border border-border rounded-lg overflow-hidden bg-background">
              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full"
                  />
                  {exportType === 'pdf' && (
                    <div className="absolute inset-0 flex flex-col">
                      {/* Top row: infos (left) + image (right) */}
                      <div 
                        className="flex border-b border-border"
                        style={{ height: `${100 - (showRemarks ? remarksHeight : 0)}%` }}
                      >
                        {showInfos && (
                          <div
                            className="bg-muted/50 border-r border-border p-1 text-[6px] text-foreground flex flex-col gap-1"
                            style={{ width: `${infosWidth}%` }}
                          >
                            <span className="font-bold">scène *</span>
                            <span>titre</span>
                            <span>timecode</span>
                            <span>date</span>
                          </div>
                        )}
                        <div
                          className="flex-1 flex items-center justify-center text-[8px] text-muted-foreground"
                        >
                          image
                        </div>
                      </div>
                      {/* Bottom: remarks */}
                      {showRemarks && (
                        <div
                          className="bg-background border-t border-border flex items-start p-1"
                          style={{ height: `${remarksHeight}%` }}
                        >
                          <span className="text-[6px] text-muted-foreground">Remarques</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-muted-foreground">
                  Chargement de l'aperçu...
                </div>
              )}
            </div>
          </div>
        </div>

        {isExporting && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Export en cours...</span>
              <span>
                {progress.current} / {progress.total}
              </span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} />
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Export en cours...' : 'Exporter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
