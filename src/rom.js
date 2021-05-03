export default class Rom {

  constructor(data) {
    this.rom = Uint8Array.from(data);
  }

  get size() {
    return this.rom.length;
  }

  read(addr) {
    return this.rom[addr];
  }
}

