import Oscillator from './oscillator.js';
import { CPU_CLOCK } from '../constants/cpu.js';
import { counterTable, globalGain } from '../constants/apu.js';

export default class Triangle {

  constructor() {
    this.reset();
    this.oscillator = new Oscillator('triangle');
    this.oscillator.setVolume(this.volume)
  }

  get volume() {
    return 0x01 * globalGain;
  }

  reset() {
    this.lengthCounter = 0;
    this.isLengthCounterEnable = false;
  }

  // Length counter
  // When clocked by the frame counter, the length counter is decremented except when:
  // The length counter is 0, or The halt flag is set
  updateCounter() {
    if (this.isLengthCounterEnable && this.lengthCounter > 0) {
      this.lengthCounter--;
    }
    if (this.linearCounter > 0) {
      this.linearCounter--;
    }
    if (this.lengthCounter === 0 && this.linearCounter === 0) {
      this.oscillator.stop();
    }
  }

  write(addr, data) {
    if (addr === 0x00) {
      this.isLengthCounterEnable = !(data & 0x80);
      this.linearCounter = data & 0x7F;
      this.oscillator.setVolume(this.volume);
    }
    else if (addr === 0x02) {
      this.dividerForFrequency &= 0x700;
      this.dividerForFrequency |= data;
    }
    else if (addr === 0x03) {
      // Programmable timer, length counter
      this.dividerForFrequency &= 0xFF;
      this.dividerForFrequency |= ((data & 0x7) << 8);
      if (this.isLengthCounterEnable) {
        this.lengthCounter = counterTable[data & 0xF8];
      }
      this.frequency = CPU_CLOCK / ((this.dividerForFrequency + 1) * 32);
      this.oscillator.setVolume(this.volume);
      this.start();
    }
  }

  start() {
    this.oscillator.start();
    this.oscillator.setFrequency(this.frequency);
  }

  close() {
    this.oscillator.close();
  }
}