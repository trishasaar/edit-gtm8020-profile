const { getExpertItem, updateExpertItem, publishSite } = require("../../lib/webflow");
const { validateMemberstackToken, getCorsHeaders } = require("../../lib/auth");

// Fields experts are allowed to edit (using actual Webflow CMS slugs)
const EDITABLE_FIELDS = [
  "position",              // Headline
  "short-description",     // Short Bio
  "experience-highlights", // Career Highlights
  "linkedin-link",         // LinkedIn Link
  "profile-link",          // Profile Link / Website
  "how-many-years-of-experience", // Years of Experience
  "headshot-url-2",        // Headshot URL
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

  // Validate request has auth header (Memberstack login on the portal page is the primary auth)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      const item = await getExpertItem(itemId);

      // Return only editable fields + name for display
      // Map CMS slugs to friendly keys for the frontend
      const editableData = {
        id: item.id,
        name: item.fieldData?.name || "",
        headline: item.fieldData?.position || "",
        "short-bio": item.fieldData?.["short-description"] || "",
        "career-highlights": item.fieldData?.["experience-highlights"] || "",
        "linkedin-link": item.fieldData?.["linkedin-link"] || "",
        "profile-link": item.fieldData?.["profile-link"] || "",
        "years-of-experience": item.fieldData?.["how-many-years-of-experience"] || "",
        "headshot-url": item.fieldData?.["headshot-url-2"] || "",
        slug: item.fieldData?.slug || "",
      };

      return res.status(200).json(editableData);
    }

    if (req.method === "POST") {
      const body = req.body;

      // Map friendly frontend keys to actual Webflow CMS slugs
      const FIELD_MAP = {
        headline: "position",
        "short-bio": "short-description",
        "career-highlights": "experience-highlights",
        "linkedin-link": "linkedin-link",
        "profile-link": "profile-link",
        "years-of-experience": "how-many-years-of-experience",
        "headshot-url": "headshot-url-2",
      };

      // Filter and map to CMS field slugs
      const sanitizedData = {};
      for (const [friendlyKey, cmsSlug] of Object.entries(FIELD_MAP)) {
        if (body[friendlyKey] !== undefined) {
          sanitizedData[cmsSlug] = typeof body[friendlyKey] === "string"
            ? body[friendlyKey].trim()
            : body[friendlyKey];
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
