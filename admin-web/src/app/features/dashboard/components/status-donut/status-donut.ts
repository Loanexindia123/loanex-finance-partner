import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

export interface DonutSlice {
  key: string;
  label: string;
  count: number;
  color: string;
}

interface DonutRing {
  key: string;
  color: string;
  dasharray: string;
  dashoffset: number;
}

const VIEW = 180;
const CX = VIEW / 2;
const CY = VIEW / 2;
const RADIUS = 62;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-status-donut',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './status-donut.html',
  styleUrl: './status-donut.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusDonut {
  readonly slices = input.required<DonutSlice[]>();
  readonly total = input.required<number>();
  readonly centerLabel = input.required<string>();
  readonly caption = input<string>();

  readonly view = VIEW;
  readonly cx = CX;
  readonly cy = CY;
  readonly radius = RADIUS;
  readonly circumference = CIRCUMFERENCE;
  readonly revealed = signal(false);

  readonly rings = computed<DonutRing[]>(() => {
    const total = this.total();
    const visible = this.slices().filter((slice) => slice.count > 0);
    if (!total || visible.length === 0) {
      return [];
    }

    const gap = visible.length > 1 ? 4.2 : 0;
    const usable = Math.max(CIRCUMFERENCE - gap * visible.length, 0);
    let cursor = 0;

    return visible.map((slice) => {
      const length = (slice.count / total) * usable;
      const ring: DonutRing = {
        key: slice.key,
        color: slice.color,
        dasharray: `${length} ${CIRCUMFERENCE - length}`,
        dashoffset: -cursor,
      };
      cursor += length + gap;
      return ring;
    });
  });

  readonly legend = computed(() => {
    const total = this.total();
    return this.slices().map((slice) => ({
      ...slice,
      percent: total > 0 ? Math.round((slice.count / total) * 100) : 0,
    }));
  });

  readonly summary = computed(() => {
    const parts = this.legend().map((slice) => `${slice.label} ${slice.count}`);
    return `${this.total()} ${this.centerLabel()}. ${parts.join(', ')}.`;
  });

  constructor() {
    const reduceMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      this.revealed.set(true);
      return;
    }
    afterNextRender(() => {
      requestAnimationFrame(() => this.revealed.set(true));
    });
  }
}
