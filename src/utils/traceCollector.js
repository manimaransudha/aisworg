import {logger} from './logger.js';

/**
 * TraceCollector - Captures granular steps of the analytical process
 * for the "Raw View" / Data Trace transparency feature.
 */
class TraceCollector {
  constructor() {
    this.traces = new Map();
  }

  /**
   * Initialize a new trace for a symbol
   */
  init(symbol) {
    this.traces.set(symbol, {
      symbol,
      timestamp: new Date(),
      steps: []
    });
  }

  /**
   * Clear traces for a specific phase (deduplication)
   */
  clearPhase(symbol, phase) {
    const trace = this.traces.get(symbol);
    if (!trace || !trace.steps) return;

    trace.steps = trace.steps.filter(s => s.phase !== phase);
    logger.debug(`[TraceCollector] Cleared phase '${phase}' for ${symbol}. Remaining steps: ${trace.steps.length}`);
  }

  /**
   * Record a calculation step
   * @param {string} symbol 
   * @param {Object} entry { phase, category, name, formula, inputs, result }
   */
  record(symbol, entry) {
    const trace = this.traces.get(symbol);
    if (!trace) {
      logger.error(`[TraceCollector] FAILED to record ${entry.name} for ${symbol}. Trace context MISSING. Current keys: ${Array.from(this.traces.keys()).join(', ')}`);
      return;
    }
    // High-visibility log for debugging UI issues
    logger.debug(`[TraceCollector] >>> TRACE RECORDED <<< | Symbol: ${symbol} | Phase: ${entry.phase} | Cat: ${entry.category} | Name: ${entry.name} | Result: ${JSON.stringify(entry.result)}`);

    // Sanitize entries for UI safety
    const sanitizedEntry = {...entry};

    // Sanitize Inputs
    if (entry.inputs) {
      const si = {};
      Object.entries(entry.inputs).forEach(([k, v]) => {
        // Skip large system objects AND redundant metadata
        const skipKeys = [
          'annual', 'quarterly', 'priceHistory', 'engine', 'ctx', 'history',
          'symbol', 'name', 'index' // Redundant metadata
        ];
        if (skipKeys.includes(k)) return;

        if (v === null || v === undefined) si[k] = 'N/A';
        else if (typeof v === 'object') {
          si[k] = Array.isArray(v) ? `Array(${v.length})` : 'Object';
        } else {
          // Flatten/Format numbers
          const n = parseFloat(v);
          si[k] = isNaN(n) ? v : Number(n.toFixed(2));
        }
      });
      sanitizedEntry.inputs = si;
    }

    // Sanitize Result
    if (entry.result !== undefined && entry.result !== null && typeof entry.result === 'object') {
      sanitizedEntry.result = Array.isArray(entry.result) ? `Array(${entry.result.length})` : 'Object';
    }

    trace.steps.push({
      ...sanitizedEntry,
      timestamp: new Date()
    });
  }

  /**
   * Get the full trace for a symbol
   */
  getTrace(symbol) {
    return this.traces.get(symbol);
  }

  /**
   * Clear trace context to prevent memory leaks
   */
  clear(symbol) {
    this.traces.delete(symbol);
  }
}

export const traceCollector = new TraceCollector();
