// GTM 80/20 Expert Profile Editor
// This script goes into the Webflow /edit-profile page (via embed or custom code)
// Requires Memberstack to be installed on the site

const API_BASE = "https://gtm8020-expert-portal.vercel.app"; // Update after Vercel deploy

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("expert-edit-form");
  const loadingEl = document.getElementById("loading-state");
  const formEl = document.getElementById("form-state");
  const successEl = document.getElementById("success-state");
  const errorEl = document.getElementById("error-state");
  const expertNameEl = document.getElementById("expert-name-display");
  const submitBtn = document.getElementById("submit-btn");

  function showState(state) {
    loadingEl.style.display = state === "loading" ? "block" : "none";
    formEl.style.display = state === "form" ? "block" : "none";
    successEl.style.display = state === "success" ? "block" : "none";
    errorEl.style.display = state === "error" ? "block" : "none";
  }

  showState("loading");

  try {
    // Wait for Memberstack to be ready
    const memberstack = window.$memberstackDom;
    if (!memberstack) {
      throw new Error("Memberstack not loaded");
    }

    const memberData = await memberstack.getCurrentMember();
    if (!memberData || !memberData.data) {
      window.location.href = "/expert-login";
      return;
    }

    const member = memberData.data;
    const token = await memberstack.getMemberToken();
    const webflowItemId = member.customFields?.webflowItemId;

    if (!webflowItemId) {
      throw new Error("Your account is not linked to an expert profile. Please contact the admin.");
    }

    // Fetch expert data from our API
    const response = await fetch(`${API_BASE}/api/expert/${webflowItemId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load your profile data");
    }

    const data = await response.json();

    // Populate form fields
    expertNameEl.textContent = data.name || "Expert";
    document.getElementById("field-headline").value = data.headline || "";
    document.getElementById("field-short-bio").value = data["short-bio"] || "";
    document.getElementById("field-career-highlights").value = data["career-highlights"] || "";
    document.getElementById("field-linkedin-link").value = data["linkedin-link"] || "";
    document.getElementById("field-profile-link").value = data["profile-link"] || "";
    document.getElementById("field-years-of-experience").value = data["years-of-experience"] || "";

    // Show headshot preview if exists
    const headshotPreview = document.getElementById("headshot-preview");
    if (data["headshot-url"]) {
      headshotPreview.src = data["headshot-url"];
      headshotPreview.style.display = "block";
    }

    showState("form");

    // Handle form submission
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      const updatedData = {
        headline: document.getElementById("field-headline").value,
        "short-bio": document.getElementById("field-short-bio").value,
        "career-highlights": document.getElementById("field-career-highlights").value,
        "linkedin-link": document.getElementById("field-linkedin-link").value,
        "profile-link": document.getElementById("field-profile-link").value,
        "years-of-experience": document.getElementById("field-years-of-experience").value,
      };

      try {
        const updateResponse = await fetch(`${API_BASE}/api/expert/${webflowItemId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updatedData),
        });

        if (!updateResponse.ok) {
          const errData = await updateResponse.json();
          throw new Error(errData.error || "Failed to update profile");
        }

        showState("success");

        // Show form again after 3 seconds
        setTimeout(() => {
          showState("form");
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Changes";
        }, 3000);
      } catch (err) {
        document.getElementById("error-message").textContent = err.message;
        showState("error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Changes";
      }
    });
  } catch (err) {
    document.getElementById("error-message").textContent = err.message;
    showState("error");
  }
});
