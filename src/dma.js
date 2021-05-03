export default class Dma {
  constructor(ram, ppu) {
    this.isProcessing = false;
    this.ramAddr = 0x0000;
    this.ram = ram;
    this.ppu = ppu;
  }

  get isDmaProcessing() {
    return this.isProcessing;
  }

  runDma() {
    if (!this.isProcessing) return;
    for (let i = 0; i < 0x100; i = (i + 1) | 0) {
      this.ppu.transferSprite(i, this.ram.read(this.ramAddr + i));
    }
    this.isProcessing = false;
  }

  write(data) {
    this.ramAddr = data << 8;
    this.isProcessing = true;
  }
}
