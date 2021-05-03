import { dict } from './opcode.js';

export default class Debugger {
  constructor() {
    window.__disassembled = () => this.displayDisaasembled();
    console.log('dev');
  }
  
  setup(rom) {
    const debugInfo = [];
    let pc = 0;
    let opcodeIndex = 0;
    while (typeof rom[pc] !== 'undefined') {
      const op = [];
      const opcodeAddr = (0x8000 + pc).toString(16);
      const opcode = dict[rom[pc].toString(16).toUpperCase()];
      if (!opcode) {
        debugInfo[opcodeIndex] = [opcodeAddr];
        pc++;
        opcodeIndex++;
        continue;
      }
      op.push(opcode.fullName);
      pc++;
      switch (opcode.mode) {
        case 'accumulator':
        case 'implied': {
          debugInfo[opcodeIndex] = [opcodeAddr, ...op];
          opcodeIndex++;
          continue;
        }
      }
      op.push(rom[pc]);
      pc++;
      switch (opcode.mode) {
        case 'immediate':
        case 'relative':
        case 'zeroPage':
        case 'zeroPageX':
        case 'zeroPageY':
        case 'preIndexedIndirect':
        case 'postIndexedIndirect': {
          debugInfo[opcodeIndex] = [opcodeAddr, ...op];
          opcodeIndex++;
          continue;
        }
      }
      op.push(rom[pc]);
      debugInfo[opcodeIndex] = [opcodeAddr, ...op];
      opcodeIndex++;
      pc++;
    }
    this.debugInfo = debugInfo;
  }

  displayDisaasembled() {
    this.debugInfo.forEach(d => console.log(d));
  }
}
