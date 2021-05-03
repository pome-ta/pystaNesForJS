'use strict';

import { NES } from './nes.js';

const nes_path = new URL('static/roms/nestest.nes', location.protocol + '//' + location.host + location.pathname).href

fetch(nes_path)
  .then((res) => res.arrayBuffer())
  .then((nesFile) => {
    const nes = new NES();
    nes.load(nesFile);
    nes.start();
  });

