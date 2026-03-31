const { getExpertItem, updateExpertItem, publishSite } = require("../../lib/webflow");
const { validateMemberstackToken, getCorsHeaders } = require("../../lib/auth");

// Fields experts are allowed to edit
const EDITABLE_FIELDS = [
  "headline",
  "short-bio",
  "career-highlights",
  "linkedin-link",
  "profile-link",
  "years-of-experience",
  "headshot-url",
];

module.exports = async function handler(req, res) {
  const corsHeaders = getCorsHeaders();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  // Set CORS headers on all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const { itemId } = req.query;

  if (!itemId) {
    return res.status(400).json({ error: "Missing itemId" });
  }

  // Validate Memberstack auth
  const member = await validateMemberstackToken(req);
  if (!member) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verify the logged-in member owns this CMS item
  const memberWebflowId = member.customFields?.webflowItemId || member.metaData?.webflowItemId;
  if (memberWebflowId !== itemId) {
    return res.status(403).json({ error: "You can only edit your own profile" });
  }

  try {
    if (req.method === "GET") {
      const item = await getExpertItem(itemId);

      // Return only editable fields + name for display
      const editableData = {
        id: item.id,
        name: item.fieldData?.name || "",
        headline: item.fieldData?.headline || "",
        "short-bio": item.fieldData?.["short-bio"] || "",
        "career-highlights": item.fieldData?.["career-highlights"] || "",
        "linkedin-link": item.fieldData?.["linkedin-link"] || "",
        "profile-link": item.fieldData?.["profile-link"] || "",
        "years-of-experience": item.fieldData?.["years-of-experience"] || "",
        "headshot-url": item.fieldData?.["headshot-url"] || "",
        slug: item.fieldData?.slug || "",
      };

      return res.status(200).json(editableData);
    }

    if (req.method === "POST") {
      const body = req.body;

      // Filter to only allow editable fields
      const sanitizedData = {};
      for (const field of EDITABLE_FIELDS) {
        if (body[field] !== undefined) {
          sanitizedData[field] = typeof body[field] === "string"
            ? body[field].trim()
            : body[field];
        }
      }

      if (Object.keys(sanitizedData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      // Update the CMS item
      const updated = await updateExpertItem(itemId, sanitizedData);

      // Publish the site so changes go live
      await publishSite();

      return res.status(200).json({
        success: true,
        message: "Profile updated and published",
        updated: sanitizedData,
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("API error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
