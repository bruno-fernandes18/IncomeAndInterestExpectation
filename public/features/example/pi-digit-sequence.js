import { DEMO_CONFIG } from './example-demo-config.js';

/** Deterministic demo values from Pi digits and the rotating weighting cycle. */
export class PiDigitSequence {
  constructor(digits = DEMO_CONFIG.piDigits, multipliers = DEMO_CONFIG.digitMultipliers) {
    this.digits = digits;
    this.multipliers = multipliers;
    this.digitIndex = 0;
    this.multiplierIndex = 0;
    this.maximumScaledDigit = DEMO_CONFIG.highestPiDigit * Math.max(...multipliers);
  }

  nextUnit() {
    const digit = Number(this.digits[this.digitIndex]);
    const multiplier = this.multipliers[this.multiplierIndex];
    this.digitIndex = (this.digitIndex + 1) % this.digits.length;
    this.multiplierIndex = (this.multiplierIndex + 1) % this.multipliers.length;
    return (digit * multiplier + 1) / (this.maximumScaledDigit + 2);
  }

  nextInteger(minimum, maximum) {
    return minimum + Math.floor(this.nextUnit() * (maximum - minimum + 1));
  }
}
