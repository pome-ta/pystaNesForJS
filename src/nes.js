import { parse } from './parser.js';
import Cpu from './cpu.js';
/*import Apu from './apu/apu.js';*/
import Ppu from './ppu.js';
import Rom from './rom.js';
import Ram from './ram.js';
import Dma from './dma.js';
import CpuBus from './bus/cpu-bus.js';
import PpuBus from './bus/ppu-bus.js'
// todo: Keypad
import CanvasRenderer from './renderer/canvas.js';
import Interrupts from './interrupts.js';

import Debugger from './debugger.js';


export class NES {
  
  constructor() {
    this.frame = this.frame.bind(this);
    this.canvasRenderer = new CanvasRenderer('nes');
  }

  load(nes) {
    const { characterROM, programROM, isHorizontalMirror } = parse(nes);
    const dev = false;
    if (dev) {
      const nesDebugger = new Debugger();
      nesDebugger.setup(programROM);
    }
    const ppuConfig = {
      isHorizontalMirror,
    };
    // todo: keypad
    this.ram = new Ram(2048);
    this.characterMem = new Ram(0x4000);
    // copy charactorROM to internal RAM
    for (let i = 0; i < characterROM.length; i++) {
      this.characterMem.write(i, characterROM[i]);
    }
    this.programROM = new Rom(programROM);
    this.ppuBus = new PpuBus(this.characterMem);
    this.interrupts = new Interrupts();
    /*this.apu = new Apu(this.interrupts);*/
    this.ppu = new Ppu(this.ppuBus, this.interrupts, ppuConfig);
    this.dma = new Dma(this.ram, this.ppu);
    this.cupBus = new CpuBus(
      this.ram,
      this.programROM,
      this.ppu,
      this.dma,
      /*this.apu,*/
    );
    this.cpu = new Cpu(this.cupBus, this.interrupts);
    this.cpu.reset();
  }

  frame() {
    // console.time('loop') // eslint-disable-line no-console
    while (true) { // eslint-disable-line no-constant-condition
      let cycle = 0;
      if (this.dma.isDmaProcessing) {
        this.dma.runDma();
        cycle = 514;
      }
      cycle += this.cpu.run();
      const renderingData = this.ppu.run(cycle * 3);
      /*this.apu.run(cycle);*/
      if (renderingData) {
        this.canvasRenderer.render(renderingData);
        break;
      }
    }
    //console.log('loop');
    // console.timeEnd('loop'); // eslint-disable-line no-console
    requestAnimationFrame(this.frame);
  }

  start() {
    requestAnimationFrame(this.frame);
  }

  close() {
    console.log('apu_close');
    /*this.apu.close();*/
  }
}
