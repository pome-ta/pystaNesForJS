export default class PpuBus {
  constructor(characterRam) {
    this.characterRam = characterRam;
  }

  readByPpu(addr) {
    return this.characterRam.read(addr);
  }

  writeByPpu(addr, data) {
    this.characterRam.write(addr, data);
  }
}
