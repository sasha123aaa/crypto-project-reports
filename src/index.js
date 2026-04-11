import { getProjectBySlug } from "./config/projects.js";
import { buildReport } from "./lib/build-report.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/report/")) {
      const slug = url.pathname.replace("/api/report/", "").replace(/\/$/, "");
      return handleReportApi(slug);
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleReportApi(slug) {
  const project = getProjectBySlug(slug);
  if (!project) return json({ error: "Unknown project slug", slug }, 404);

  try {
    const report = await buildReport(project);
    return json(report, 200);
  } catch (error) {
    return json({ error: "Failed to build report", details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
