(function () {
    'use strict';

    console.log("[Strava Auto Inviter] pageScript.js loaded in page context");

    // Listen for messages from the content script
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CHECK_STRAVA') {
            console.log("[Strava Auto Inviter] Received CHECK_STRAVA message");
            window.postMessage({
                type: 'STRAVA_RESPONSE',
                stravaExists: typeof Strava !== 'undefined',
                controllerAvailable: !!(Strava?.Share?.Controller?.getInstance?.()),
                autocompleteData: Strava?.Share?.Controller?.getInstance?.().autocompleteData || []
            }, '*');
        }
    });

    // Notify content script when Strava is ready
    if (typeof Strava !== 'undefined' && Strava?.Share?.Controller?.getInstance?.()) {
        console.log("[Strava Auto Inviter] Strava object detected, sending initial response");
        window.postMessage({
            type: 'STRAVA_RESPONSE',
            stravaExists: true,
            controllerAvailable: true,
            autocompleteData: Strava.Share.Controller.getInstance().autocompleteData || []
        }, '*');
    }
})();