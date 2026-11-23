import type { RouteCtx } from "../routeContext.ts";
import { handleMaintenanceRoutes } from "./maintenance.ts";
import { handleOverviewRoutes } from "./overview.ts";
import { handleEpisodeTrashRoutes } from "./episodeTrash.ts";
import { handlePreparationRoutes } from "./preparation.ts";
import { handlePublishRoutes } from "./publish.ts";
import { handleLabRoutes } from "./labs.ts";
import { handlePreviewRoutes } from "./previews.ts";
import { handleSeriesRoutes } from "./series.ts";
import { handleChannelRoutes } from "./channel.ts";
import { handleVoiceRoutes } from "./voice.ts";
import { handleJobRoutes } from "./jobs.ts";
import { handlePaceRoutes } from "./pace.ts";
import { handleQualityRoutes } from "./quality.ts";
import { handleNightlyRoutes } from "./nightly.ts";

/**
 * مسارات الاستوديو بحسب المسؤولية (العمل ٨): كل ملف يتولى مساراته ويعيد true، وإلا يمر الطلب إلى التالي ثم إلى
 * بقية api.ts. كل الطلبات مرت قبلها بفحص الطلب الواحد في api.ts (security.ts)؛ وفحص المالك داخل كل مسار كما هو.
 * الجرد في tests/server-route-inventory.test.ts.
 */
const HANDLERS = [
  handleMaintenanceRoutes, handleOverviewRoutes, handleEpisodeTrashRoutes, handlePreparationRoutes, handlePublishRoutes,
  handleLabRoutes, handlePreviewRoutes, handleSeriesRoutes, handleChannelRoutes, handleVoiceRoutes, handleJobRoutes, handlePaceRoutes,
  handleQualityRoutes, handleNightlyRoutes,
];

export const handleStudioRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  for (const handle of HANDLERS) if (await handle(ctx)) return true;
  return false;
};
