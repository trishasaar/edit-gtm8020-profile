const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function getExpertItem(itemId) {
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const res = await fetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items/${itemId}`,
    { headers: getHeaders() }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Webflow API error (GET): ${res.status} - ${error}`);
  }

  return res.json();
}

async function updateExpertItem(itemId, fieldData) {
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const res = await fetch(
    `${WEBFLOW_API_BASE}/collections/${collectionId}/items/${itemId}`,
    {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ fieldData }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Webflow API error (PATCH): ${res.status} - ${error}`);
  }

  return res.json();
}

async function publishSite() {
  const siteId = process.env.WEBFLOW_SITE_ID;
  const res = await fetch(`${WEBFLOW_API_BASE}/sites/${siteId}/publish`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ publishToWebflowSubdomain: false }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Webflow API error (PUBLISH): ${res.status} - ${error}`);
  }

  return res.json();
}

module.exports = { getExpertItem, updateExpertItem, publishSite };
