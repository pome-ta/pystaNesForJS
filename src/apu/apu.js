import Square from './square.js';
import Noise from './noise.js';
import Triangle from './triangle.js';
import Interrupts from '../interrupts.js';
import { DIVIDE_COUNT_FOR_240HZ } from '../constants/apu.js';

export default class Apu {

  constructor(interrupts) {
    this.interrupts = interrupts;
    // APU Registers
    // (0x4000 〜 0x4017)
    this.registers = new Uint8Array(0x18);
    this.cycle = 0;
    this.step = 0;
    this.square = [new Square(), new Square()];
    this.triangle = new Triangle();
    this.noise = new Noise();
    this.enableIrq = false;
  }

  run(cycle) {
    this.cycle += cycle;
    if (this.cycle >= DIVIDE_COUNT_FOR_240HZ) {
      // invoked by 240hz
      this.cycle -= DIVIDE_COUNT_FOR_240HZ;
      if (this.sequencerMode) {
        this.updateBySequenceMode1();
      } else {
        this.updateBySequenceMode0();
      }
    }
  }

  updateBySequenceMode0() {
    this.updateEnvelope();
    if (this.step % 2 === 1) {
      this.updateSweepAndLengthCounter();
    }
    this.step++;
    if (this.step === 4) {
      if (this.enableIrq) {
        this.interrupts.assertIrq();
      }
      this.step = 0;
    }
  }

  updateBySequenceMode1() {
    if (this.step % 2 === 0) {
      this.updateSweepAndLengthCounter();
    }
    this.step++;
    if (this.step === 5) {
      this.step = 0;
    } else {
      this.updateEnvelope();
    }
  }

  updateSweepAndLengthCounter() {
    this.square.forEach((s)=> s.updateSweepAndLengthCounter());
    this.triangle.updateCounter();
    this.noise.updateCounter();
  }

  updateEnvelope() {
    this.square.forEach((s) => s.updateEnvelope());
    this.noise.updateEnvelope();
  }

  write(addr, data) {
    /* eslint-disable */
    // console.log('apu write', addr, data);
    // TODO: FIx perf
    if (addr <= 0x03) {
      // square wave control register
      this.square[0].write(addr, data);
    } else if (addr <= 0x07) {
      // square wave control register
      this.square[1].write(addr - 0x04, data);
    } else if (addr <= 0x0B) {
      // triangle
      this.triangle.write(addr - 0x08, data);
    } else if (addr <= 0x0F) {
      // noise
      this.noise.write(addr - 0x0C, data);
    } else if (addr === 0x17) {
      this.sequencerMode = data & 0x80 ? 1 : 0;
      this.registers[addr] = data;
      this.enableIrq = !!(data & 0x40);
    }
  }

  read(addr) {
    // TODO: Implement other registers
    if (addr === 0x15) {
      this.interrupts.deassertIrq();
    }
    return 0;
  }

  close() {
    this.noise.close();
    this.square[0].close();
    this.square[1].close();
    this.triangle.close();
  }
}
