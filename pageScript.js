(function () {
    'use strict';

    console.log("[Strava Auto Inviter] pageScript.js loaded in page context");

    function getCsrfToken() {
        const el = document.getElementsByName('csrf')[0];
        if (!el) {
            console.warn("[Strava Auto Inviter] CSRF meta tag not found");
            return null;
        }
        const token = el.getAttribute("content");
        if (!token) {
            console.warn("[Strava Auto Inviter] CSRF meta tag has no content");
        }
        return token;
    }

    let autocompleteLoaded = false;
    let autocompleteLoading = false;

    async function loadAutocompleteAthletes() {
        if (autocompleteLoaded || autocompleteLoading) return;
        autocompleteLoading = true;

        const csrf = getCsrfToken();
        if (!csrf) {
            console.warn("[Strava Auto Inviter] No CSRF token, cannot load autocomplete data");
            autocompleteLoading = false;
            return;
        }

        console.log("[Strava Auto Inviter] Loading autocomplete athlete data...");

        try {
            const res = await fetch("https://www.strava.com/share/autocomplete_athlete_data", {
                method: "GET",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "x-requested-with": "XMLHttpRequest",
                    "x-csrf-token": csrf
                }
            });

            if (!res.ok) {
                console.error("[Strava Auto Inviter] autocomplete_athlete_data failed:", res.status, await res.text());
                autocompleteLoading = false;
                return;
            }

            const data = await res.json();
            console.log("[Strava Auto Inviter] autocomplete_athlete_data response:", data);

            if (!Array.isArray(data)) {
                console.warn("[Strava Auto Inviter] Unexpected autocomplete data format");
                autocompleteLoading = false;
                return;
            }

            autocompleteLoaded = true;
            autocompleteLoading = false;

            window.postMessage({
                source: 'StravaAutoInviter',
                type: 'STRAVA_AUTOCOMPLETE_DATA',
                athletes: data
            }, '*');
        } catch (e) {
            console.error("[Strava Auto Inviter] Error loading autocomplete data:", e);
            autocompleteLoading = false;
        }
    }

    async function inviteAthletes(athleteIds) {
        if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
            console.log("[Strava Auto Inviter] No athlete IDs to invite");
            return;
        }

        const match = location.pathname.match(/\/clubs\/(\d+)\/group_events\/(\d+)/);
        if (!match) {
            console.warn("[Strava Auto Inviter] Could not parse club/event id from URL:", location.pathname);
            return;
        }
        const [, clubId, eventId] = match;

        const csrf = getCsrfToken();
        if (!csrf) {
            console.warn("[Strava Auto Inviter] No CSRF token, cannot send invite");
            return;
        }

        const url = `https://www.strava.com/clubs/${clubId}/group_events/${eventId}/invite`;

        console.log("[Strava Auto Inviter] Sending invite request:", url, athleteIds);

        try {
            const res = await fetch(url, {
                method: "PUT",
                credentials: "include",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json",
                    "x-requested-with": "XMLHttpRequest",
                    "x-csrf-token": csrf
                },
                body: JSON.stringify({ athlete_ids: athleteIds })
            });

            const ok = res.ok;
            const bodyText = await res.text().catch(() => null);
            let parsed = null;
            try {
                parsed = bodyText ? JSON.parse(bodyText) : null;
            } catch {
                // ignore
            }

            if (!ok) {
                console.error("[Strava Auto Inviter] Invite request failed:", res.status, bodyText);
            } else {
                console.log("[Strava Auto Inviter] Invite request success:", parsed || bodyText);
            }

            window.postMessage({
                source: 'StravaAutoInviter',
                type: 'STRAVA_INVITE_RESULT',
                success: ok,
                status: res.status,
                body: parsed || bodyText
            }, '*');
        } catch (e) {
            console.error("[Strava Auto Inviter] Error sending invite request:", e);
            window.postMessage({
                source: 'StravaAutoInviter',
                type: 'STRAVA_INVITE_RESULT',
                success: false,
                error: String(e)
            }, '*');
        }
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data) return;
        const data = event.data;
        if (data.source !== 'StravaAutoInviter') return;

        if (data.type === 'STRAVA_LOAD_AUTOCOMPLETE') {
            console.log("[Strava Auto Inviter] Received STRAVA_LOAD_AUTOCOMPLETE");
            loadAutocompleteAthletes();
        }

        if (data.type === 'STRAVA_INVITE_ATHLETES') {
            console.log("[Strava Auto Inviter] Received STRAVA_INVITE_ATHLETES:", data.athleteIds);
            inviteAthletes(data.athleteIds || []);
        }
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        loadAutocompleteAthletes();
    } else {
        window.addEventListener('DOMContentLoaded', loadAutocompleteAthletes);
    }
})();
