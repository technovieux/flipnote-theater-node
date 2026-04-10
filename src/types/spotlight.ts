export interface SpotlightChannel {
  name: string;
  defaultValue: number;
  type: 'dimmer' | 'color' | 'position' | 'gobo' | 'other';
}

export interface SpotlightFixture {
  name: string;
  manufacturer: string;
  channels: SpotlightChannel[];
}

export interface SpotlightObject {
  id: string;
  name: string;
  fixture: SpotlightFixture;
  dmxAddress: number;
  channelValues: number[];
  // Position on the 2D canvas
  x: number;
  y: number;
  opacity: number;
  color: string;
}

export interface SpotlightKeyframe {
  time: number;
  channelValues: number[];
}
