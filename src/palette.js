export default class Palette {
  constructor() {
    this.ram = new Uint8Array(0x20);
  }

  isSpriteMirror(addr){
    return (addr === 0x10) || (addr === 0x14) || (addr === 0x18) || (addr === 0x1c);
  }

  isBackgroundMirror(addr){
    return (addr === 0x04) || (addr === 0x08) || (addr === 0x0c);
  }

  read(){
    return this.ram.map((v, i)=> {
      if (this.isSpriteMirror(i)) return this.ram[i - 0x10];
      if (this.isBackgroundMirror(i)) return this.ram[0x00];
      return v;
    });
  }

  getPaletteAddr(addr){
    const mirrorDowned = ((addr & 0xFF) % 0x20);
    //NOTE: 0x3f10, 0x3f14, 0x3f18, 0x3f1c is mirror of 0x3f00, 0x3f04, 0x3f08, 0x3f0c 
    return this.isSpriteMirror(mirrorDowned) ? mirrorDowned - 0x10 : mirrorDowned;
  }

  write(addr, data) {
    this.ram[this.getPaletteAddr(addr)] = data;
  }
}

