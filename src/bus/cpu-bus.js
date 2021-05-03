//import Rom from '../rom.js';
//import Ram from '../ram.js';
//import Ppu from '../ppu.js';
// import Keypad from '../keypad';
//import Dma from '../dma.js';
// import Apu from '../apu';

// import type { Word, Byte } from '../types/common';

export default class CpuBus {
  constructor(ram, programROM, ppu, /*keypad,*/ dma/*, apu*/) {
    this.ram = ram;
    this.programROM = programROM;
    this.ppu = ppu;
    // this.apu = apu;
    // this.keypad = keypad;
    this.dma = dma;
  }

  readByCpu(addr) {
    if (addr < 0x0800) {
      return this.ram.read(addr);
    } else if (addr < 0x2000) {
      // mirror
      return this.ram.read(addr - 0x0800);
    } else if (addr < 0x4000) {
      // mirror
      const data = this.ppu.read((addr - 0x2000) % 8);
      return data;
    } else if (addr === 0x4016) {
      // TODO Add 2P
      // return +this.keypad.read();
      //console.log('return: +this.keypad.read();');

    } else if (addr >= 0xC000) {
      // Mirror, if prom block number equals 1
      if (this.programROM.size <= 0x4000) {
        return this.programROM.read(addr - 0xC000);
      }
      return this.programROM.read(addr - 0x8000);
    } else if (addr >= 0x8000) {
      // ROM
      return this.programROM.read(addr - 0x8000);
    } else {
      // FIXME:
      return 0;
    }
  }

  writeByCpu(addr, data) {
    // log.debug(`cpu:write addr = ${addr}`, data);
    if (addr < 0x0800) {
      // RAM
      this.ram.write(addr, data);
    } else if (addr < 0x2000) {
      // mirror
      this.ram.write(addr - 0x0800, data);
    } else if (addr < 0x2008) {
      // PPU
      this.ppu.write(addr - 0x2000, data);
    } else if (addr >= 0x4000 && addr < 0x4020) {
      if (addr === 0x4014) {
        this.dma.write(data);
      } else if (addr === 0x4016) {
        // TODO Add 2P
        //console.log('fixme: Add 2P')
        // this.keypad.write(data);
      } else {
        // APU
        //console.log('fixme: APU');
        // this.apu.write(addr - 0x4000, data);
      }
    }
  }
}
