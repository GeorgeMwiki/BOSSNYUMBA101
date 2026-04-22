/**
 * @bossnyumba/forecasting — public surface.
 *
 * Per-org and platform-scale forecasts with conformal prediction
 * intervals. Ports-and-adapters throughout; a downstream inference
 * service (Python + PyTorch + PyG) implements the TGN port.
 *
 * Three layers stack:
 *   1. Local tabular baseline (GBM-style) — floor model.
 *   2. Temporal Graph Network on the tenant subgraph — primary.
 *   3. Geometric foundation model on the DP-aggregated platform
 *      graph — moat product, via PlatformForecast.
 *
 * Every forecast ships with a calibrated prediction interval plus
 * driver narrative; nothing ever leaves this package as a bare
 * point estimate.
 */

export * from './types.js';
export {
  createAbsoluteResidualCalibrator,
  createProbabilityCalibrator,
  quantile,
  type Calibrator,
  type CalibrationPoint,
  type CalibratorOptions,
} from './conformal/inductive.js';
export {
  createFeatureExtractor,
  type FeatureExtractor,
  type FeatureExtractorDeps,
  type FeatureExtractorOptions,
  type TabularSource,
  type GraphSource,
  type TemporalSource,
} from './features/extractor.js';
export {
  createTgnForecaster,
  type CalibratorRegistry,
  type DriverExplainer,
  type TgnInferenceAdapter,
  type TgnInferencePrediction,
  type TgnForecasterDeps,
} from './models/tgn-forecaster.js';
export { canonicalJSON, sha256Hex, sha256Short } from './util/hash.js';
