// todo: 型整理

//import type { Byte, Word } from '../types/common';

import RAM from './ram.js';
import PpuBus from './bus/ppu-bus.js';
import Interrupts from './interrupts.js';
import Palette from './palette.js';
//import type { PaletteRam } from './palette';

const SPRITES_NUMBER = 0x100;
/*
export type Sprite = $ReadOnlyArray<$ReadOnlyArray<number>>;

export type SpriteType = 'background' | 'sprite'

export type SpriteWithAttribute = $Exact<{
  sprite: Sprite;
  x: Byte;
  y: Byte;
  attr: Byte;
  spriteId: number;
}>;

export type Tile = $Exact<{
  sprite: Sprite;
  paletteId: Byte;
  scrollX: Byte;
  scrollY: Byte;
}>;

export type RenderingData = $Exact<{
  palette: PaletteRam;
  background: ?$ReadOnlyArray<Tile>;
sprites: ?$ReadOnlyArray<SpriteWithAttribute>;
}>;

export type Config = $Exact<{
  isHorizontalMirror: boolean;
}>;
*/
export default class Ppu {
  constructor(bus, interrupts, config) {
    this.registers = new Uint8Array(0x08);
    this.cycle = 0;
    this.line = 0;
    this.isValidVramAddr = false;
    this.isLowerVramAddr = false;
    this.isHorizontalScroll = true;
    this.vramAddr = 0x0000;
    this.vram = new RAM(0x2000);
    this.vramReadBuf = 0;
    this.spriteRam = new RAM(0x100);
    this.spriteRamAddr = 0;
    this.background = [];
    this.sprites = [];
    this.bus = bus;
    this.interrupts = interrupts;
    this.config = config;
    this.scrollX = 0;
    this.scrollY = 0;
    this.palette = new Palette();
  }

  get vramOffset() {
    return (this.registers[0x00] & 0x04) ? 32 : 1;
  }

  get nameTableId() {
    return this.registers[0x00] & 0x03;
  }

  getPalette() {
    return this.palette.read();
  }

  clearSpriteHit() {
    this.registers[0x02] &= 0xBF;
  }

  setSpriteHit() {
    this.registers[0x02] |= 0x40;
  }

  hasSpriteHit() {
    const y = this.spriteRam.read(0);
    // const id = this.spriteRam.read(1);
    // if (id === 0) return false;
    return (y === this.line) && this.isBackgroundEnable && this.isSpriteEnable;
  }

  get hasVblankIrqEnabled() {
    return !!(this.registers[0] & 0x80);
  }

  get isBackgroundEnable() {
    return !!(this.registers[0x01] & 0x08);
  }

  get isSpriteEnable() {
    return !!(this.registers[0x01] & 0x10);
  }

  get scrollTileX() {
    return ~~((this.scrollX + ((this.nameTableId % 2) * 256)) / 8);
  }

  get scrollTileY() {
    return ~~((this.scrollY + (~~(this.nameTableId / 2) * 240)) / 8);
  }

  get tileY() {
    return ~~(this.line / 8) + this.scrollTileY;
  }

  get backgroundTableOffset() {
    return (this.registers[0] & 0x10) ? 0x1000 : 0x0000;
  }

  setVblank() {
    this.registers[0x02] |= 0x80;
  }

  isVblank() {
    return !!(this.registers[0x02] & 0x80);
  }

  clearVblank() {
    this.registers[0x02] &= 0x7F;
  }

  getBlockId(tileX, tileY) {
    return ~~((tileX % 4) / 2) + (~~((tileY % 4) / 2)) * 2;
  }

  getAttribute(tileX, tileY, offset) {
    const addr = ~~(tileX / 4) + (~~(tileY / 4) * 8) + 0x03C0 + offset;
    return this.vram.read(this.mirrorDownSpriteAddr(addr));
  }

  getSpriteId(tileX, tileY, offset) {
    const tileNumber = tileY * 32 + tileX;
    const spriteAddr = this.mirrorDownSpriteAddr(tileNumber + offset);
    return this.vram.read(spriteAddr);
  }

  mirrorDownSpriteAddr(addr) {
    if (!this.config.isHorizontalMirror) return addr;
    if (addr >= 0x0400 && addr < 0x0800 || addr >= 0x0C00) {
      return addr -= 0x400;
    }
    return addr;

  }

  // The PPU draws one line at 341 clocks and prepares for the next line.
  // While drawing the BG and sprite at the first 256 clocks,
  // it searches for sprites to be drawn on the next scan line.
  // Get the pattern of the sprite searched with the remaining clock.
  run(cycle) {
    this.cycle += cycle;
    if(this.line === 0) {
      this.background.length = 0;
      this.buildSprites();
    }

    if (this.cycle >= 341) {
      this.cycle -= 341;
      this.line++;

      if (this.hasSpriteHit()) {
        this.setSpriteHit();
      }

      if (this.line <= 240 && this.line % 8 === 0 && this.scrollY <= 240) {
        this.buildBackground();
      }
      if (this.line === 241) {
        this.setVblank();
        if (this.hasVblankIrqEnabled) {
          this.interrupts.assertNmi();
        }
      }

      if (this.line === 262) {
        this.clearVblank();
        this.clearSpriteHit();
        this.line = 0;
        this.interrupts.deassertNmi();
        return {
          background: this.isBackgroundEnable ? this.background : null,
          sprites: this.isSpriteEnable ? this.sprites : null,
          palette: this.getPalette(),
        };
      }
    }
    return null;
  }

  buildTile(tileX, tileY, offset) {
    // INFO see. http://hp.vector.co.jp/authors/VA042397/nes/ppu.html
    const blockId = this.getBlockId(tileX, tileY);
    const spriteId = this.getSpriteId(tileX, tileY, offset);
    const attr = this.getAttribute(tileX, tileY, offset);
    const paletteId = (attr >> (blockId * 2)) & 0x03;
    const sprite = this.buildSprite(spriteId, this.backgroundTableOffset);
    return {
      sprite,
      paletteId,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
    };
  }

  buildBackground() {
    // INFO: Horizontal offsets range from 0 to 255. "Normal" vertical offsets range from 0 to 239,
    // while values of 240 to 255 are treated as -16 through -1 in a way, but tile data is incorrectly
    // fetched from the attribute table.
    const clampedTileY = this.tileY % 30;
    const tableIdOffset = (~~(this.tileY / 30) % 2) ? 2 : 0;
    // background of a line.
    // Build viewport + 1 tile for background scroll.
    for (let x = 0; x < 32 + 1; x = (x + 1) | 0) {
      const tileX = (x + this.scrollTileX);
      const clampedTileX = tileX % 32;
      const nameTableId = (~~(tileX / 32) % 2) + tableIdOffset;
      const offsetAddrByNameTable = nameTableId * 0x400;
      const tile = this.buildTile(clampedTileX, clampedTileY, offsetAddrByNameTable);
      this.background.push(tile);
    }
  }

  buildSprites() {
    const offset = (this.registers[0] & 0x08) ? 0x1000 : 0x0000;
    for (let i = 0; i < SPRITES_NUMBER; i = (i + 4) | 0) {
      // INFO: Offset sprite Y position, because First and last 8line is not rendered.
      const y = this.spriteRam.read(i) - 8;
      if (y < 0) return;
      const spriteId = this.spriteRam.read(i + 1);
      const attr = this.spriteRam.read(i + 2);
      const x = this.spriteRam.read(i + 3);
      const sprite = this.buildSprite(spriteId, offset);
      this.sprites[i / 4] = { sprite, x, y, attr, spriteId };
    }
  }

  buildSprite(spriteId, offset) {
    const sprite = new Array(8).fill(0).map(() => [0, 0, 0, 0, 0, 0, 0, 0]);
    for (let i = 0; i < 16; i = (i + 1) | 0) {
      for (let j = 0; j < 8; j = (j + 1) | 0) {
        const addr = spriteId * 16 + i + offset;
        const ram = this.readCharacterRAM(addr);
        if (ram & (0x80 >> j)) {
          sprite[i % 8][j] += 0x01 << ~~(i / 8);
        }
      }
    }
    return sprite;
  }

  readCharacterRAM(addr) {
    return this.bus.readByPpu(addr);
  }

  writeCharacterRAM(addr, data) {
    this.bus.writeByPpu(addr, data);
  }

  readVram() {
    const buf = this.vramReadBuf;
    if (this.vramAddr >= 0x2000) {
      const addr = this.calcVramAddr();
      this.vramAddr += this.vramOffset;
      if (addr >= 0x3F00) {
        return this.vram.read(addr);
      }
      this.vramReadBuf = this.vram.read(addr);
    } else {
      this.vramReadBuf = this.readCharacterRAM(this.vramAddr);
      this.vramAddr += this.vramOffset;
    }
    return buf;
  }

  read(addr) {
    /*
    | bit  | description                                 |
    +------+---------------------------------------------+
    | 7    | 1: VBlank clear by reading this register    |
    | 6    | 1: sprite hit                               |
    | 5    | 0: less than 8, 1: 9 or more                |
    | 4-0  | invalid                                     |                                 
    |      | bit4 VRAM write flag [0: success, 1: fail]  |
    */
    if (addr === 0x0002) {
      this.isHorizontalScroll = true;
      const data = this.registers[0x02];
      this.clearVblank();
      // this.clearSpriteHit();
      return data;
    }
    // Write OAM data here. Writes will increment OAMADDR after the write
    // reads during vertical or forced blanking return the value from OAM at that address but do not increment.
    if (addr === 0x0004) {
      return this.spriteRam.read(this.spriteRamAddr);
    }
    if (addr === 0x0007) {
      return this.readVram();
    }
    return 0;
  }

  write(addr, data) {
    if (addr === 0x0003) {
      return this.writeSpriteRamAddr(data);
    }
    if (addr === 0x0004) {
      return this.writeSpriteRamData(data);
    }
    if (addr === 0x0005) {
      return this.writeScrollData(data);
    }
    if (addr === 0x0006) {
      return this.writeVramAddr(data);
    }
    if (addr === 0x0007) {
      return this.writeVramData(data);
    }
    this.registers[addr] = data;
  }

  writeSpriteRamAddr(data) {
    this.spriteRamAddr = data;
  }

  writeSpriteRamData(data) {
    this.spriteRam.write(this.spriteRamAddr, data);
    this.spriteRamAddr += 1;
  }

  writeScrollData(data) {
    if (this.isHorizontalScroll) {
      this.isHorizontalScroll = false;
      this.scrollX = data & 0xFF;
    } else {
      this.scrollY = data & 0xFF;
      this.isHorizontalScroll = true;
    }
  }

  writeVramAddr(data) {
    if (this.isLowerVramAddr) {
      this.vramAddr += data;
      this.isLowerVramAddr = false;
      this.isValidVramAddr = true;
    } else {
      this.vramAddr = data << 8;
      this.isLowerVramAddr = true;
      this.isValidVramAddr = false;
    }
  }

  calcVramAddr() {
    return (this.vramAddr >= 0x3000 && this.vramAddr < 0x3f00)
      ? this.vramAddr -= 0x3000
      : this.vramAddr - 0x2000;
  }

  writeVramData(data) {
    if (this.vramAddr >= 0x2000) {
      if (this.vramAddr >= 0x3f00 && this.vramAddr < 0x4000) {
        this.palette.write(this.vramAddr - 0x3f00, data);
      } else {
        this.writeVram(this.calcVramAddr(), data);
      }
    } else {
      this.writeCharacterRAM(this.vramAddr, data);
    }
    this.vramAddr += this.vramOffset;
  }

  writeVram(addr, data) {
    this.vram.write(addr, data);
  }

  transferSprite(index, data) {
    // The DMA transfer will begin at the current OAM write address.
    // It is common practice to initialize it to 0 with a write to PPU 0x2003 before the DMA transfer.
    // Different starting addresses can be used for a simple OAM cycling technique
    // to alleviate sprite priority conflicts by flickering. If using this technique
    // after the DMA OAMADDR should be set to 0 before the end of vblank to prevent potential OAM corruption (See: Errata).
    // However, due to OAMADDR writes also having a "corruption" effect[5] this technique is not recommended.
    const addr = index + this.spriteRamAddr;
    this.spriteRam.write(addr % 0x100, data);
  }
}
