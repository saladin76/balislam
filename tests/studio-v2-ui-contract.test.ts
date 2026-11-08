/**
 * Root CI discovery bridge for the isolated Studio V2 UI test suites.
 * UI sources remain in app/src/review; no production files are modified.
 */
import "../app/src/review/model.test.ts";
import "../app/src/review/backend.integration.test.ts";
import "../app/src/review/SceneReviewWorkspace.test.tsx";
