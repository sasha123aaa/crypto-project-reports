export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/report/")) {
      return handleStaticReportApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleStaticReportApi(request, env, url) {
  const slug = url.pathname.replace("/api/report/", "").replace(/\/$/, "");

  if (!slug) {
    return json({ error: "Missing report slug" }, 400);
  }

  const jsonUrl = new URL(`/data/reports/${slug}.json`, request.url);
  const assetRequest = new Request(jsonUrl.toString(), request);

  const response = await env.ASSETS.fetch(assetRequest);

  if (response.status === 404) {
    return json(
      {
        error: "Report JSON not found",
        slug,
        expected_path: `/public/data/reports/${slug}.json`,
      },
      404
    );
  }

  if (!response.ok) {
    return json(
      {
        error: "Failed to load report JSON",
        slug,
        status: response.status,
      },
      500
    );
  }

  const text = await response.text();

  return new Response(text, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
