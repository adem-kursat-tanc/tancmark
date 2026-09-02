import { EventEmitter } from "node:events";

/**
 * Breach Signal — AEGIS v4.0 "Sentient Fortress" merkezi sinir sistemi.
 *
 * Tasarım kuralları:
 *  - **Per-call scope**: her analiz çağrısı kendi `BreachSignalBus` örneğini
 *    kullanır. Modül seviyesinde singleton YOK — yarış durumlarına ve
 *    çapraz-istek sızıntılarına karşı izolasyon zorunlu.
 *  - **Sinyal ≠ karar**: bus sadece kanal-seviyesi ipuçlarını taşır
 *    (zero-width silinmiş, homoglyph normalize edilmiş, vb). Verdict ladder
 *    (strong/ambiguous/insufficient) ve false-accusation guard değişmez.
 *  - **Kalıcı state yok**: boost SADECE içinde bulunduğu çağrının nominasyon
 *    eşiğini düşürür. Çağrı bittiğinde bus çöpe gider.
 */

export type BreachSignalType =
  | "zero_width_stripped"
  | "homoglyph_normalized"
  | "linguistic_dna_paraphrased"
  | "honeytoken_detected"
  | "canary_triggered"
  | "cascade_hash_break";

export type BreachSeverity = "low" | "medium" | "high";

export interface BreachSignalContext {
  clientId?: string;
  docId?: string;
  [k: string]: unknown;
}

export interface BreachSignal {
  type: BreachSignalType;
  severity: BreachSeverity;
  /** Hangi kod parçası emit etti — ör. "analyzeTextMultiChannel:zero_width". */
  source: string;
  timestamp: number;
  context: BreachSignalContext;
}

export type BreachSignalInput = Omit<BreachSignal, "timestamp"> & {
  timestamp?: number;
};

const SEVERITY_RANK: Record<BreachSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export class BreachSignalBus extends EventEmitter {
  private readonly _signals: BreachSignal[] = [];

  /** Yeni sinyal yayınla. Bus'ın iç listesine kaydedilir + listener'lara emit edilir. */
  emitSignal(input: BreachSignalInput): BreachSignal {
    const signal: BreachSignal = {
      type: input.type,
      severity: input.severity,
      source: input.source,
      timestamp: input.timestamp ?? Date.now(),
      context: { ...(input.context ?? {}) },
    };
    this._signals.push(signal);
    this.emit("signal", signal);
    this.emit(input.type, signal);
    return signal;
  }

  /** Bu bus'a yayınlanmış tüm sinyallerin sığ kopyası. */
  signals(): readonly BreachSignal[] {
    return this._signals.slice();
  }

  hasSignal(type: BreachSignalType): boolean {
    for (const s of this._signals) if (s.type === type) return true;
    return false;
  }

  hasAnySignal(types: ReadonlyArray<BreachSignalType>): boolean {
    for (const t of types) if (this.hasSignal(t)) return true;
    return false;
  }

  countByType(): Partial<Record<BreachSignalType, number>> {
    const out: Partial<Record<BreachSignalType, number>> = {};
    for (const s of this._signals) {
      out[s.type] = (out[s.type] ?? 0) + 1;
    }
    return out;
  }

  highestSeverity(): BreachSeverity | null {
    let best: BreachSeverity | null = null;
    for (const s of this._signals) {
      if (best === null || SEVERITY_RANK[s.severity] > SEVERITY_RANK[best]) {
        best = s.severity;
      }
    }
    return best;
  }
}

/** Yeni izole bus üret. Her analiz/çağrı kendi instance'ını oluşturmalı. */
export function createBreachSignalBus(): BreachSignalBus {
  return new BreachSignalBus();
}

/**
 * Adaptif duyarlılık eşikleri.
 *
 * Carrier stripping (zero_width_stripped VEYA homoglyph_normalized) tespit
 * edildiğinde, o ANALİZ ÇAĞRISI için Linguistic DNA + Homoglyph nominasyon
 * eşikleri düşürülür. Boost yalnızca tek-aday durumlarında bir adayın
 * suspectedClientId olarak yükselmesine izin verir; ≥2 aday boost eşiğini
 * geçerse multi-suspect olarak demote edilir → false-accusation guard.
 */
export const SENSITIVITY_BOOST = {
  /** Linguistic DNA (synonym channel) eşiği: 0.70 → 0.50. */
  linguisticDnaNormal: 0.7,
  linguisticDnaBoosted: 0.5,
  /** Homoglyph kanalı eşiği: 0.60 → 0.40. */
  homoglyphNormal: 0.6,
  homoglyphBoosted: 0.4,
} as const;

/** Bus carrier-stripping kanıtı içeriyor mu? */
export function shouldApplySensitivityBoost(
  bus: BreachSignalBus | undefined,
): boolean {
  if (!bus) return false;
  return bus.hasAnySignal(["zero_width_stripped", "homoglyph_normalized"]);
}
