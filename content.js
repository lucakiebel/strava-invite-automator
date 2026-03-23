(function () {
    'use strict';

    console.log("[Strava Auto Inviter] content.js loaded");

    let autocompleteData = [];
    let autocompleteLoaded = false;

    let autocompleteResolve;
    const autocompleteReadyPromise = new Promise((resolve) => {
        autocompleteResolve = resolve;
    });

    function normalizeName(s) {
        return String(s || '').trim().toLowerCase();
    }

    function getMatchingAthleteIdsFromAutocomplete(nameFilter) {
        if (!Array.isArray(nameFilter) || !Array.isArray(autocompleteData)) {
            return [];
        }

        const targets = nameFilter
            .map(n => n && n.trim())
            .filter(Boolean)
            .map(normalizeName);

        const ids = new Set();

        for (const athlete of autocompleteData) {
            const athleteNameNorm = normalizeName(athlete.name);
            for (const target of targets) {
                if (
                    athleteNameNorm === target ||
                    athleteNameNorm.includes(target) ||
                    target.includes(athleteNameNorm)
                ) {
                    ids.add(athlete.id);
                }
            }
        }

        const result = Array.from(ids);
        console.log("[Strava Auto Inviter] Matching athlete IDs:", result);
        return result;
    }

    async function ensureAutocompleteLoaded() {
        if (autocompleteLoaded) return;
        window.postMessage({
            source: 'StravaAutoInviter',
            type: 'STRAVA_LOAD_AUTOCOMPLETE'
        }, '*');
        await autocompleteReadyPromise;
    }

    function isShareModal(dialog) {
        if (!dialog || !(dialog instanceof HTMLElement)) return false;

        let titleText = '';

        const ariaLabelledBy = dialog.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const titleEl = document.getElementById(ariaLabelledBy);
            if (titleEl) {
                titleText = titleEl.textContent || '';
            }
        }

        if (!titleText) {
            const heading = dialog.querySelector('h1, h2');
            if (heading) {
                titleText = heading.textContent || '';
            }
        }

        titleText = (titleText || '').toLowerCase();

        return titleText.includes('event teilen') || titleText.includes('share event');
    }

    function findShareModal() {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const dialog of dialogs) {
            if (isShareModal(dialog)) return dialog;
        }
        return null;
    }

    function findShareButton(modal) {
        if (!modal) return null;

        const buttons = modal.querySelectorAll('button');
        let fallback = null;

        for (const btn of buttons) {
            const text = (btn.textContent || '').trim().toLowerCase();
            if (!text) continue;
            if (text === 'teilen' || text === 'share') {
                return btn;
            }
            fallback = btn;
        }

        return fallback;
    }

    function injectButtonInModal(modal, nameFilter) {
        console.log("[Strava Auto Inviter] Trying to inject button into modal");

        if (!modal) {
            console.log("[Strava Auto Inviter] No modal passed to injectButtonInModal");
            return;
        }

        if (modal.querySelector('#auto-invite-btn')) {
            console.log("[Strava Auto Inviter] Button already exists in this modal");
            return;
        }

        const shareButton = findShareButton(modal);
        if (!shareButton) {
            console.log("[Strava Auto Inviter] No share button found in modal");
        }

        const autoInviteButton = document.createElement('button');
        autoInviteButton.id = 'auto-invite-btn';
        autoInviteButton.type = 'button';
        autoInviteButton.textContent = 'Alle automatisch einladen';

        if (shareButton && shareButton.className) {
            autoInviteButton.className = shareButton.className.replace('Button_primary', 'Button_secondary');
        } else {
            autoInviteButton.className = 'btn btn-secondary';
        }

        autoInviteButton.style.marginLeft = '8px';

        autoInviteButton.addEventListener('click', async () => {
            console.log("[Strava Auto Inviter] Auto-invite button clicked");

            if (!Array.isArray(nameFilter) || nameFilter.length === 0) {
                console.log("[Strava Auto Inviter] No athlete names configured");
                return;
            }

            await ensureAutocompleteLoaded();

            const athleteIds = getMatchingAthleteIdsFromAutocomplete(nameFilter);
            if (!athleteIds.length) {
                console.log("[Strava Auto Inviter] No matching athlete IDs found");
                return;
            }

            window.postMessage({
                source: 'StravaAutoInviter',
                type: 'STRAVA_INVITE_ATHLETES',
                athleteIds
            }, '*');
        });

        if (shareButton && shareButton.parentElement) {
            shareButton.parentElement.insertBefore(autoInviteButton, shareButton);
            console.log('[Strava Auto Inviter] Button inserted next to share button');
        } else {
            modal.appendChild(autoInviteButton);
            console.log('[Strava Auto Inviter] Button appended to modal as fallback');
        }
    }

    function observeModal(nameFilter) {
        console.log("[Strava Auto Inviter] Observing DOM for share modal");

        const processedModals = new WeakSet();

        const existing = findShareModal();
        if (existing && !processedModals.has(existing)) {
            processedModals.add(existing);
            injectButtonInModal(existing, nameFilter);
        }

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;

                    let dialog = node.matches('[role="dialog"]') ? node : null;
                    if (!dialog && node.querySelector) {
                        dialog = node.querySelector('[role="dialog"]');
                    }
                    if (!dialog) continue;
                    if (!isShareModal(dialog)) continue;
                    if (processedModals.has(dialog)) continue;

                    console.log("[Strava Auto Inviter] Share modal detected");
                    processedModals.add(dialog);
                    injectButtonInModal(dialog, nameFilter);
                }
            }
        });

        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function injectPageScript() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('pageScript.js');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
        console.log("[Strava Auto Inviter] pageScript.js injected");
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data) return;
        const data = event.data;
        if (data.source !== 'StravaAutoInviter') return;

        if (data.type === 'STRAVA_AUTOCOMPLETE_DATA' && Array.isArray(data.athletes)) {
            console.log("[Strava Auto Inviter] Received STRAVA_AUTOCOMPLETE_DATA:", data.athletes.length);
            autocompleteData = data.athletes;
            autocompleteLoaded = true;
            autocompleteResolve && autocompleteResolve();
        }

        if (data.type === 'STRAVA_INVITE_RESULT') {
            console.log("[Strava Auto Inviter] Invite result:", data);
        }
    });

    chrome.storage.sync.get(['athleteNames'], ({ athleteNames }) => {
        console.log("[Strava Auto Inviter] athleteNames:", athleteNames);
        const nameFilter = Array.isArray(athleteNames) ? athleteNames : [];

        injectPageScript();
        observeModal(nameFilter);
    });
})();
