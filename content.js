(function () {
    'use strict';

    console.log("[Strava Auto Inviter] content.js loaded");

    function getMatchingAthleteIds(nameFilter, autocompleteData) {
        console.log("[Strava Auto Inviter] Fetching matching athlete IDs");
        if (!autocompleteData) {
            console.log("[Strava Auto Inviter] No autocomplete data available");
            return [];
        }
        return autocompleteData
            .filter(u => nameFilter.includes(u.name))
            .map(u => u.id);
    }

    function injectButtonWhenReady(nameFilter, autocompleteData) {
        console.log("[Strava Auto Inviter] Checking for invite button");
        const modal = document.querySelector('#invite_on_strava, .modal');
        if (!modal) {
            console.log("[Strava Auto Inviter] Modal not found");
            return;
        }

        if (document.querySelector('#auto-invite-btn')) {
            console.log("[Strava Auto Inviter] Button already exists");
            return; // Prevent duplicates
        }

        const autoInviteButton = document.createElement('button');
        autoInviteButton.id = 'auto-invite-btn';
        autoInviteButton.textContent = 'Alle automatisch einladen';
        autoInviteButton.className = 'btn btn-secondary';
        autoInviteButton.style.marginLeft = '10px';

        autoInviteButton.addEventListener('click', () => {
            const ids = getMatchingAthleteIds(nameFilter, autocompleteData);
            const input = document.querySelector('input[name="strava-athletes"]');
            if (!input) {
                console.log("[Strava Auto Inviter] Input not found");
                return;
            }
            input.value = ids.join(',');
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('[Strava Auto Inviter] IDs set:', ids);
        });

        const inviteButton = document.querySelector('#invite_on_strava') || modal;
        inviteButton.parentNode.insertBefore(autoInviteButton, inviteButton.nextSibling);
        console.log('[Strava Auto Inviter] Button added');
    }

    function observeModal(nameFilter, autocompleteData) {
        console.log("[Strava Auto Inviter] Observing modal for button injection");
        const observer = new MutationObserver(() => {
            console.log("[Strava Auto Inviter] Mutation detected");
            const modal = document.querySelector('#invite_on_strava, .modal');
            if (modal) {
                console.log("[Strava Auto Inviter] Modal detected, injecting button");
                injectButtonWhenReady(nameFilter, autocompleteData);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    }

    function injectPageScript(nameFilter) {
        console.log("[Strava Auto Inviter] Injecting pageScript.js");
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('pageScript.js');
        script.onload = () => script.remove(); // Clean up after loading
        (document.head || document.documentElement).appendChild(script);

        // Listen for Strava response
        window.addEventListener('message', (event) => {
            if (event.data.type === 'STRAVA_RESPONSE') {
                console.log("[Strava Auto Inviter] Received STRAVA_RESPONSE:", event.data);
                if (event.data.stravaExists && event.data.controllerAvailable) {
                    console.log("[Strava Auto Inviter] Strava ready, starting observer");
                    observeModal(nameFilter, event.data.autocompleteData);
                }
            }
        });
    }

    chrome.storage.sync.get(['athleteNames'], ({ athleteNames }) => {
        console.log("[Strava Auto Inviter] athleteNames:", athleteNames);
        const nameFilter = athleteNames || [];
        injectPageScript(nameFilter);
    });
})();