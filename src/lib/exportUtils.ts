import { EditorState, EditorObject, ObjectProperties, Scene, Keyframe } from '@/types/editor';
import { interpolateColor } from '@/lib/colorUtils';
import jsPDF from 'jspdf';
import { render3DSceneToCanvas, getAllKeyframeTimes3D } from '@/lib/export3DUtils';

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1080;

export interface ExportOptions {
  type: 'images' | 'video' | 'pdf';
  format: 'jpg' | 'png' | 'webp';
  videoFormat?: 'webm' | 'mp4';
  backgroundColor: string;
  // PDF specific
  showRemarks: boolean;
  showInfos: boolean;
  remarksHeight: number; // percentage of page height for remarks
  infosWidth: number;    // percentage of top row width for infos (left side)
}

export interface KeyframeExportData {
  time: number;
  sceneNumber: number;
  sceneName: string;
  modificationDate: string;
}

// Get interpolated properties at a specific time
const getInterpolatedPropertiesAt = (
  object: EditorObject,
  time: number,
  animatedMode: boolean = true
): ObjectProperties => {
  if (object.keyframes.length === 0) return object.properties;

  const sortedKeyframes = [...object.keyframes].sort((a, b) => a.time - b.time);

  let prevKf: Keyframe | null = null;
  let nextKf: Keyframe | null = null;

  for (const kf of sortedKeyframes) {
    if (kf.time <= time) {
      prevKf = kf;
    } else if (!nextKf && kf.time > time) {
      nextKf = kf;
      break;
    }
  }

  if (!prevKf && !nextKf) return object.properties;
  if (!prevKf) return nextKf!.properties;
  if (!nextKf) return prevKf.properties;

  if (!animatedMode) {
    return prevKf.properties;
  }

  const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);
  const interpolate = (a: number, b: number) => a + (b - a) * progress;

  return {
    x: interpolate(prevKf.properties.x, nextKf.properties.x),
    y: interpolate(prevKf.properties.y, nextKf.properties.y),
    width: interpolate(prevKf.properties.width, nextKf.properties.width),
    height: interpolate(prevKf.properties.height, nextKf.properties.height),
    rotation: interpolate(prevKf.properties.rotation, nextKf.properties.rotation),
    opacity: interpolate(prevKf.properties.opacity, nextKf.properties.opacity),
    color: interpolateColor(prevKf.properties.color, nextKf.properties.color, progress),
  };
};

// Format time to timecode
export const formatTimecode = (ms: number): string => {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const frames = Math.floor((ms % 1000) / 40); // 25fps

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

// Get scene info at a given time
const getSceneAtTime = (scenes: Scene[], time: number): { number: number; name: string } => {
  const sortedScenes = [...scenes].sort((a, b) => a.time - b.time);
  let currentScene = { number: 0, name: 'Sans titre' };

  for (const scene of sortedScenes) {
    if (scene.time <= time) {
      currentScene = { number: scene.number, name: scene.name };
    } else {
      break;
    }
  }

  return currentScene;
};

// Render scene to canvas
export const renderSceneToCanvas = (
  state: EditorState,
  time: number,
  backgroundColor: string,
  includeOverlay: boolean = false,
  scenes?: Scene[]
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  // Draw background image if exists
  if (state.backgroundImage) {
    return canvas; // Will be replaced with async version
  }

  // Draw objects (in reverse order, first in array = on top)
  const reversedObjects = [...state.objects].reverse();
  for (const obj of reversedObjects) {
    const props = getInterpolatedPropertiesAt(obj, time, state.animatedMode);
    drawObject(ctx, obj.type, props);
  }

  return canvas;
};

// Async version that handles background image
export const renderSceneToCanvasAsync = async (
  state: EditorState,
  time: number,
  backgroundColor: string,
  includeOverlay: boolean = false
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

  // Draw background image if exists
  if (state.backgroundImage) {
    try {
      const img = await loadImage(state.backgroundImage);
      // Center the image (object-contain behavior)
      const scale = Math.min(SCENE_WIDTH / img.width, SCENE_HEIGHT / img.height);
      const x = (SCENE_WIDTH - img.width * scale) / 2;
      const y = (SCENE_HEIGHT - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    } catch (e) {
      console.error('Failed to load background image:', e);
    }
  }

  // Draw objects (in reverse order, first in array = on top)
  const reversedObjects = [...state.objects].reverse();
  for (const obj of reversedObjects) {
    const props = getInterpolatedPropertiesAt(obj, time, state.animatedMode);
    drawObject(ctx, obj.type, props);
  }

  // Draw overlay if requested
  if (includeOverlay) {
    const scene = getSceneAtTime(state.scenes, time);
    drawOverlay(ctx, scene.number, scene.name, time, new Date().toLocaleString('fr-FR'));
  }

  return canvas;
};

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const drawObject = (
  ctx: CanvasRenderingContext2D,
  type: string,
  props: ObjectProperties
) => {
  ctx.save();
  ctx.translate(props.x + props.width / 2, props.y + props.height / 2);
  ctx.rotate((props.rotation * Math.PI) / 180);
  ctx.globalAlpha = props.opacity / 100;

  switch (type) {
    case 'rectangle':
      ctx.fillStyle = props.color;
      ctx.fillRect(-props.width / 2, -props.height / 2, props.width, props.height);
      break;
    case 'circle':
      ctx.fillStyle = props.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, props.width / 2, props.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.fillStyle = props.color;
      ctx.beginPath();
      ctx.moveTo(0, -props.height / 2);
      ctx.lineTo(props.width / 2, props.height / 2);
      ctx.lineTo(-props.width / 2, props.height / 2);
      ctx.closePath();
      ctx.fill();
      break;
  }

  ctx.restore();
};

const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  sceneNumber: number,
  sceneName: string,
  time: number,
  modificationDate: string
) => {
  ctx.save();

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, 400, 120);

  // Text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Scène ${sceneNumber}`, 20, 35);

  ctx.font = '20px sans-serif';
  ctx.fillText(sceneName, 20, 60);
  ctx.fillText(formatTimecode(time), 20, 85);
  ctx.fillText(modificationDate, 20, 110);

  ctx.restore();
};

// Get all unique keyframe times across all objects
export const getAllKeyframeTimes = (state: EditorState): number[] => {
  const times = new Set<number>();
  times.add(0); // Always include start

  if (state.mode3D) {
    for (const obj of state.objects3D) {
      for (const kf of obj.keyframes) {
        times.add(kf.time);
      }
    }
  } else {
    for (const obj of state.objects) {
      for (const kf of obj.keyframes) {
        times.add(kf.time);
      }
    }
  }

  return Array.from(times).sort((a, b) => a - b);
};

// Render scene (2D or 3D) based on mode
export const renderSceneAsync = async (
  state: EditorState,
  time: number,
  backgroundColor: string,
  includeOverlay: boolean = false
): Promise<HTMLCanvasElement> => {
  if (state.mode3D) {
    return render3DSceneToCanvas(state, time, backgroundColor, includeOverlay);
  }
  return renderSceneToCanvasAsync(state, time, backgroundColor, includeOverlay);
};

// Export as image sequence
export const exportAsImageSequence = async (
  state: EditorState,
  options: ExportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  const keyframeTimes = getAllKeyframeTimes(state);

  for (let i = 0; i < keyframeTimes.length; i++) {
    const time = keyframeTimes[i];
    const canvas = await renderSceneAsync(state, time, options.backgroundColor, true);

    // Convert to blob and download
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b!),
        `image/${options.format === 'jpg' ? 'jpeg' : options.format}`,
        0.95
      );
    });

    const scene = getSceneAtTime(state.scenes, time);
    const filename = `scene_${scene.number.toString().padStart(3, '0')}_${formatTimecode(time).replace(/:/g, '-')}.${options.format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    onProgress?.(i + 1, keyframeTimes.length);

    // Small delay between downloads
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

// Export as video
export const exportAsVideo = async (
  state: EditorState,
  options: ExportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  // Determine end time based on mode
  const lastKeyframeTime = state.mode3D
    ? Math.max(...state.objects3D.flatMap((obj) => obj.keyframes.map((kf) => kf.time)), 0)
    : Math.max(...state.objects.flatMap((obj) => obj.keyframes.map((kf) => kf.time)), 0);
  const audioDuration = state.audioTracks.length > 0 ? Math.max(...state.audioTracks.map(t => t.duration * 1000)) : 0;
  const endTime = Math.max(lastKeyframeTime, audioDuration) || 5000;

  const fps = 25;
  const frameInterval = 1000 / fps;
  const totalFrames = Math.ceil(endTime / frameInterval);

  // Create a video using canvas recording
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_WIDTH;
  canvas.height = SCENE_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Pre-load background image to avoid async loading during frame rendering
  let backgroundImg: HTMLImageElement | null = null;
  if (state.backgroundImage) {
    try {
      backgroundImg = await loadImage(state.backgroundImage);
    } catch (e) {
      console.error('Failed to load background image:', e);
    }
  }

  const stream = canvas.captureStream(fps);

  // Add audio tracks if available
  if (state.audioTracks.length > 0 && state.audioTracks[0]?.file) {
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await state.audioTracks[0].file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createMediaStreamDestination();
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = audioBuffer;
      bufferSource.connect(source);
      bufferSource.start();
      stream.addTrack(source.stream.getAudioTracks()[0]);
    } catch (e) {
      console.error('Failed to add audio:', e);
    }
  }

  // Determine mimeType based on format
  const isMP4 = options.videoFormat === 'mp4';
  let mimeType = 'video/webm;codecs=vp9';
  
  // Check for MP4 support (H.264)
  if (isMP4) {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    } else {
      // Fallback to webm if MP4 not supported
      console.warn('MP4 not supported, falling back to WebM');
      mimeType = 'video/webm;codecs=vp9';
    }
  }

  const mediaRecorder = new MediaRecorder(stream, { mimeType });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const fileExtension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  const blobType = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';

  // Render a single frame synchronously (2D only)
  const renderFrameSync2D = (time: number) => {
    // Fill background
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, SCENE_WIDTH, SCENE_HEIGHT);

    // Draw pre-loaded background image
    if (backgroundImg) {
      const scale = Math.min(SCENE_WIDTH / backgroundImg.width, SCENE_HEIGHT / backgroundImg.height);
      const x = (SCENE_WIDTH - backgroundImg.width * scale) / 2;
      const y = (SCENE_HEIGHT - backgroundImg.height * scale) / 2;
      ctx.drawImage(backgroundImg, x, y, backgroundImg.width * scale, backgroundImg.height * scale);
    }

    // Draw objects
    const reversedObjects = [...state.objects].reverse();
    for (const obj of reversedObjects) {
      const props = getInterpolatedPropertiesAt(obj, time, state.animatedMode);
      drawObject(ctx, obj.type, props);
    }
  };

  // Render a frame (async for 3D)
  const renderFrame = async (time: number) => {
    if (state.mode3D) {
      const renderedCanvas = await render3DSceneToCanvas(state, time, options.backgroundColor, false);
      ctx.drawImage(renderedCanvas, 0, 0);
    } else {
      renderFrameSync2D(time);
    }
  };

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: blobType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `animation.${fileExtension}`;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    };

    const startRecording = async () => {
      mediaRecorder.start();

      let frame = 0;
      
      // Use a controlled interval for consistent frame timing
      const renderNextFrame = async () => {
        if (frame >= totalFrames) {
          mediaRecorder.stop();
          return;
        }

        const time = frame * frameInterval;
        await renderFrame(time);

        onProgress?.(frame + 1, totalFrames);
        frame++;
        
        // Use setTimeout with exact frame interval for consistent timing
        // This prevents the black flashes caused by requestAnimationFrame's variable timing
        setTimeout(renderNextFrame, frameInterval);
      };

      // Render first frame immediately to ensure canvas has content
      await renderFrame(0);
      frame = 1;
      onProgress?.(1, totalFrames);
      
      // Start the frame loop
      setTimeout(renderNextFrame, frameInterval);
    };

    startRecording();
  });
};

// Export as PDF
export const exportAsPDF = async (
  state: EditorState,
  options: ExportOptions,
  onProgress?: (current: number, total: number) => void
): Promise<void> => {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  const keyframeTimes = getAllKeyframeTimes(state);

  for (let i = 0; i < keyframeTimes.length; i++) {
    if (i > 0) pdf.addPage();

    const time = keyframeTimes[i];
    const scene = getSceneAtTime(state.scenes, time);
    const canvas = await renderSceneAsync(state, time, options.backgroundColor, false);

    // Calculate layout - Top row: [Infos (left) | Image (right)], Bottom: Remarks
    const contentWidth = pageWidth - margin * 2;
    const totalContentHeight = pageHeight - margin * 2;
    
    const remarksHeight = options.showRemarks ? (options.remarksHeight / 100) * totalContentHeight : 0;
    const topRowHeight = totalContentHeight - remarksHeight;
    
    // Info section width (left side of top row)
    const infosWidth = options.showInfos ? (options.infosWidth / 100) * contentWidth : 0;
    const imageWidth = contentWidth - infosWidth;

    let currentY = margin;

    // Top row: Info (left) and Image (right)
    // Info section (left side)
    if (options.showInfos && infosWidth > 0) {
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, currentY, infosWidth, topRowHeight, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, currentY, infosWidth, topRowHeight, 'S');

      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      
      const textX = margin + 5;
      let textY = currentY + 12;
      const lineHeight = 8;
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Scène ${scene.number}`, textX, textY);
      textY += lineHeight;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(scene.name, textX, textY);
      textY += lineHeight;
      
      pdf.text(formatTimecode(time), textX, textY);
      textY += lineHeight;
      
      pdf.text(new Date().toLocaleDateString('fr-FR'), textX, textY);
    }

    // Image section (right side of top row)
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const imgAspectRatio = SCENE_WIDTH / SCENE_HEIGHT;
    
    // Calculate the actual image dimensions to fit in available space while maintaining aspect ratio
    let actualImgWidth = imageWidth;
    let actualImgHeight = actualImgWidth / imgAspectRatio;
    
    // If image is too tall, constrain by height instead
    if (actualImgHeight > topRowHeight) {
      actualImgHeight = topRowHeight;
      actualImgWidth = actualImgHeight * imgAspectRatio;
    }
    
    // Position image in the right side
    const imgX = margin + infosWidth + (imageWidth - actualImgWidth) / 2;
    const imgY = currentY + (topRowHeight - actualImgHeight) / 2;

    pdf.addImage(
      imgData,
      'JPEG',
      imgX,
      imgY,
      actualImgWidth,
      actualImgHeight
    );
    
    // Draw border around image area
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(margin + infosWidth, currentY, imageWidth, topRowHeight, 'S');

    currentY += topRowHeight;

    // Remarks section (bottom, full width)
    if (options.showRemarks && remarksHeight > 0) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(margin, currentY, contentWidth, remarksHeight, 'F');
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(margin, currentY, contentWidth, remarksHeight, 'S');

      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Remarques', margin + 5, currentY + 8);
    }

    onProgress?.(i + 1, keyframeTimes.length);
  }

  pdf.save('storyboard.pdf');
};
