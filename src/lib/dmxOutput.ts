/**
 * DMX512 output via Web Serial API
 * Compatible with Enttec Open DMX USB and similar USB-DMX interfaces
 */

export class DMXOutput {
  private port: any = null;
  private writer: any = null;
  private channels: Uint8Array = new Uint8Array(513); // Start code + 512 channels
  private sending = false;
  private intervalId: number | null = null;

  get isConnected(): boolean {
    return this.port !== null && this.port.readable !== null;
  }

  static isSupported(): boolean {
    return 'serial' in (navigator as any);
  }

  async connect(): Promise<boolean> {
    if (!DMXOutput.isSupported()) {
      throw new Error('Web Serial API non supportée par ce navigateur. Utilisez Chrome ou Edge.');
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({
        baudRate: 250000,
        dataBits: 8,
        stopBits: 2,
        parity: 'none',
      });

      this.writer = this.port.writable?.getWriter() || null;
      this.channels.fill(0);
      return true;
    } catch (error) {
      if ((error as Error).name === 'NotFoundError') {
        return false; // User cancelled
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopRealtimeOutput();
    
    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch {}
      this.writer = null;
    }
    
    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }
  }

  setChannel(channel: number, value: number): void {
    if (channel >= 1 && channel <= 512) {
      this.channels[channel] = Math.max(0, Math.min(255, Math.round(value)));
    }
  }

  setChannels(startAddress: number, values: number[]): void {
    for (let i = 0; i < values.length; i++) {
      this.setChannel(startAddress + i, values[i]);
    }
  }

  async sendFrame(): Promise<void> {
    if (!this.writer || this.sending) return;
    
    this.sending = true;
    try {
      // DMX512 frame: send break by sending a zero byte at lower baud rate
      // Most USB-DMX interfaces handle the break automatically
      // We just send the 513 bytes (start code 0x00 + 512 channel values)
      await this.writer.write(this.channels);
    } catch (error) {
      console.error('DMX send error:', error);
    } finally {
      this.sending = false;
    }
  }

  startRealtimeOutput(fps: number = 40): void {
    this.stopRealtimeOutput();
    this.intervalId = window.setInterval(() => {
      this.sendFrame();
    }, 1000 / fps);
  }

  stopRealtimeOutput(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Blackout all channels
  blackout(): void {
    this.channels.fill(0);
  }
}

// Singleton instance
export const dmxOutput = new DMXOutput();
