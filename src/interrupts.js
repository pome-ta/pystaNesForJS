export default class Interrupts {
  constructor() {
    this.nmi = false;
  }

  get isNmiAssert(){
    return this.nmi;
  }

  get isIrqAssert(){
    return this.irq;
  }

  assertNmi() {
    this.nmi = true;
  }

  deassertNmi() {
    this.nmi = false;
  }

  assertIrq() {
    this.irq = true;
  }  

  deassertIrq() {
    this.irq = false;
  }  
}
