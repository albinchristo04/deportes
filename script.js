document.addEventListener('DOMContentLoaded', () => {
    // Player Elements
    const iframePlayer = document.getElementById('iframe-player');
    const hlsPlayer = document.getElementById('hls-player');
    const playerContainer = document.getElementById('player-container');
    const playerPlaceholder = document.getElementById('player-placeholder');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Control Elements
    const channelButtons = document.querySelectorAll('.channel-btn');
    const m3u8UrlInput = document.getElementById('m3u8-url-input');
    const loadM3u8Btn = document.getElementById('load-m3u8-btn');
    const m3u8Form = document.getElementById('m3u8-form');

    let hls = null; // Variable to hold the Hls.js instance
    let currentStreamType = null; // 'iframe' or 'hls' or null
    let currentStreamSrc = null; // Store the active src

    // --- Utility Functions ---

    function showLoader() {
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
    }

    function hideLoader() {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }

    function showPlaceholder(message = null) {
        const placeholderText = playerPlaceholder.querySelector('p');
        if (message && placeholderText) {
             placeholderText.innerHTML = message; // Update placeholder message
        }
        playerPlaceholder.style.display = 'flex'; // Show the placeholder flex container
    }


    function hidePlaceholder() {
        playerPlaceholder.style.display = 'none';
    }

    function setActiveButton(clickedButton) {
        channelButtons.forEach(button => {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false');
        });
        if (clickedButton) {
             clickedButton.classList.add('active');
             clickedButton.setAttribute('aria-pressed', 'true');
        }
    }

    function resetPlayers(showDefaultPlaceholder = true, message = null) {
        hideLoader();

        // Detach and destroy HLS if active
        if (hls) {
            hls.stopLoad();
            hls.detachMedia();
            hls.destroy();
            hls = null;
            console.log('HLS instance destroyed.');
        }

        // Reset Iframe
        iframePlayer.style.display = 'none';
        iframePlayer.src = 'about:blank';

        // Reset HLS Player
        hlsPlayer.style.display = 'none';
        hlsPlayer.pause();
        hlsPlayer.removeAttribute('src');
        if(hlsPlayer.buffered && hlsPlayer.buffered.length > 0){
             hlsPlayer.load(); // More forceful reset if needed
        }

        // Manage Placeholder visibility and message
        if (showDefaultPlaceholder) {
             const defaultMsg = 'Select a channel or enter an M3U8 URL below to begin watching.';
             showPlaceholder(message || defaultMsg);
        } else {
            hidePlaceholder(); // Keep placeholder hidden if starting a new load
        }

        currentStreamType = null;
        currentStreamSrc = null;
    }

    function displayError(message, isFatal = false) {
        hideLoader();
        console.error("Stream Error:", message);
        // More user-friendly error display instead of just alert
        const errorMsg = `Error: ${message}${isFatal ? ' Cannot load stream.' : ''}`;
        resetPlayers(true, errorMsg); // Show placeholder with error message

        if (isFatal) {
            setActiveButton(null); // Deactivate button on fatal error
        }
        // alert(`Error: ${message}`); // Keep alert for debugging if needed
    }


    // --- Player Loading Logic ---

    function loadIframeStream(iframeSrc, buttonElement) {
        if (currentStreamSrc === iframeSrc && currentStreamType === 'iframe') {
            console.log('Iframe stream already loaded.');
            return;
        }
        // Sanity check the source URL
        if (!iframeSrc || !(iframeSrc.startsWith('http:') || iframeSrc.startsWith('https:'))) {
             displayError(`Invalid iframe source URL: ${iframeSrc}`, true);
             setActiveButton(null);
             return;
        }

        resetPlayers(false); // Reset but keep placeholder hidden
        showLoader();
        setActiveButton(buttonElement); // Mark button active

        currentStreamType = 'iframe';
        currentStreamSrc = iframeSrc;

        let iframeLoadTimeout = setTimeout(() => {
            console.warn("Iframe load timeout.");
             displayError(`Timeout loading iframe content from ${iframeSrc}. The source might be down or blocking embedding.`, true);
        }, 15000); // 15 seconds timeout

        iframePlayer.onload = () => {
            clearTimeout(iframeLoadTimeout); // Clear timeout on successful load
            console.log(`Iframe loaded: ${iframeSrc}`);
            hideLoader();
            hidePlaceholder();
            iframePlayer.style.display = 'block';
        };
        iframePlayer.onerror = () => {
            clearTimeout(iframeLoadTimeout); // Clear timeout on error
            displayError(`Failed to load iframe content from ${iframeSrc}. Check console for details.`, true);
        };

        console.log(`Attempting to load Iframe: ${iframeSrc}`);
        iframePlayer.src = iframeSrc;
    }

    // *** MODIFIED: Added buttonElement parameter ***
    function loadHlsStream(m3u8Src, buttonElement = null) {
        if (currentStreamSrc === m3u8Src && currentStreamType === 'hls') {
            console.log('HLS stream already loaded.');
             if(buttonElement) setActiveButton(buttonElement); // Ensure button state matches if re-clicked
            return;
        }

        // URL Validation (already done in form submit, but good practice here too)
         try {
             const url = new URL(m3u8Src);
             if (url.protocol !== "http:" && url.protocol !== "https:") {
                 throw new Error("Invalid protocol");
             }
         } catch (error) {
             displayError(`Invalid M3U8 URL format: ${m3u8Src}`, true);
             setActiveButton(null); // Deselect button if URL is bad
             return;
         }


        resetPlayers(false);
        showLoader();
        setActiveButton(buttonElement); // Set button active immediately

        currentStreamType = 'hls';
        currentStreamSrc = m3u8Src;

        console.log(`Attempting to load M3U8: ${m3u8Src}`);

        if (Hls.isSupported()) {
            console.log("HLS.js is supported. Initializing...");
            hls = new Hls({
                 // Recommended: Add reasonable initial load timeout
                 manifestLoadingTimeOut: 10000, // 10 seconds
                 levelLoadingTimeOut: 10000, // 10 seconds
            });

             hls.on(Hls.Events.MANIFEST_PARSED, function() {
                console.log("Manifest parsed, attempting to play...");
                hideLoader();
                hidePlaceholder();
                hlsPlayer.style.display = 'block';
                 try {
                    hlsPlayer.play().catch(e => console.warn("Autoplay likely prevented by browser:", e));
                 } catch (error) {
                     console.error("Error attempting to play video:", error);
                     displayError("Could not start video playback.", false);
                 }
            });

             hls.on(Hls.Events.ERROR, function (event, data) {
                console.error('HLS.js Error:', data);
                let userMessage = "An unknown error occurred with the stream.";
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        userMessage = `Network error (${data.details}): Could not load stream data. Check connection or stream status.`;
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        userMessage = `Media error (${data.details}): Problem decoding stream. The stream might be corrupt or incompatible.`;
                        break;
                    case Hls.ErrorTypes.MUX_ERROR:
                        userMessage = `Mux error (${data.details}): Problem parsing the stream container.`;
                        break;
                    case Hls.ErrorTypes.OTHER_ERROR:
                         userMessage = `An unexpected error occurred (${data.details}).`;
                        break;
                    default:
                         userMessage = `An unexpected HLS error occurred (${data.type}, ${data.details}).`;
                }
                 // Check for manifest load errors specifically
                 if(data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR){
                    data.fatal = true; // Treat manifest errors as fatal
                    userMessage = `Could not load or parse the M3U8 playlist. URL might be wrong or stream offline. (${data.details})`;
                 }

                 displayError(userMessage, data.fatal);
                 if(data.fatal && hls) {
                    hls.destroy(); hls = null;
                 }
            });

            hls.loadSource(m3u8Src);
            hls.attachMedia(hlsPlayer);

        } else if (hlsPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            console.log("Native HLS support detected.");

             let nativeLoadTimeout = setTimeout(() => {
                  console.warn("Native HLS load timeout.");
                  displayError("Timeout loading native HLS stream. Server may be slow or stream unavailable.", true);
                  hlsPlayer.onerror = null; hlsPlayer.onloadedmetadata = null; // Clean up listeners
             }, 15000); // 15s timeout

            hlsPlayer.onloadedmetadata = () => {
                clearTimeout(nativeLoadTimeout);
                console.log("Native HLS metadata loaded, attempting to play...");
                hideLoader();
                hidePlaceholder();
                hlsPlayer.style.display = 'block';
                try {
                    hlsPlayer.play().catch(e => console.warn("Native HLS Autoplay likely prevented:", e));
                } catch(error){
                      console.error("Error attempting native HLS playback:", error);
                      displayError("Could not start native HLS playback.", false);
                }
            };
            hlsPlayer.onerror = (e) => {
                 clearTimeout(nativeLoadTimeout);
                 let message = "Failed to load or play the stream using native HLS.";
                 // Error details are less specific for native player
                 if (hlsPlayer.error) message += ` (Code: ${hlsPlayer.error.code})`;
                 displayError(message, true);
                 hlsPlayer.onerror = null; hlsPlayer.onloadedmetadata = null; // Clean up
            };

            hlsPlayer.src = m3u8Src;
            hlsPlayer.load();

        } else {
            displayError("Sorry, HLS streaming is not supported in this browser.", true);
        }
    }


    // --- Event Listeners Setup ---

    // Channel Button Clicks ( *** MODIFIED *** )
    channelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sourceUrl = button.getAttribute('data-iframe-src')?.trim(); // Use a different variable name

            // Basic validation of the source URL
             if (!sourceUrl || sourceUrl.startsWith('YOUR_CHANNEL_') || !(sourceUrl.startsWith('http:') || sourceUrl.startsWith('https:'))) {
                 alert('Channel URL is invalid or not configured.');
                 resetPlayers(true);
                 setActiveButton(null);
                 return; // Stop processing if URL is invalid
             }

            // *** M3U8 Detection Logic ***
             const isM3U8 = sourceUrl.includes('.m3u8') || sourceUrl.toLowerCase().includes('manifest(format=m3u8-aapl)'); // Add other common patterns if needed

             if (isM3U8) {
                console.log(`Detected M3U8 source from button: ${sourceUrl}`);
                loadHlsStream(sourceUrl, button); // Pass button element
            } else {
                console.log(`Detected Iframe source from button: ${sourceUrl}`);
                loadIframeStream(sourceUrl, button);
            }
        });
    });

    // M3U8 Form Submission
    m3u8Form.addEventListener('submit', (event) => {
        event.preventDefault();
        const m3u8Url = m3u8UrlInput.value.trim();

        if (m3u8Url) {
             // URL validation happens inside loadHlsStream now
             loadHlsStream(m3u8Url, null); // Pass null as button element
             // Optionally clear input:
             // m3u8UrlInput.value = '';
        } else {
            alert('Please enter an M3U8 Stream URL.');
        }
    });


    // --- Initial State & Autoplay ---
    resetPlayers(true, 'Loading Channel 1...'); // Show placeholder with loading message

    const channel1Button = document.getElementById('channel-1-btn');
    if (channel1Button) {
        // Add slight delay to allow page rendering/AdSense maybe?
         setTimeout(() => {
             console.log('Autoplaying Channel 1...');
             channel1Button.click(); // Simulate click to trigger loading logic
         }, 500); // 0.5 second delay
    } else {
        console.warn('Channel 1 button (#channel-1-btn) not found for autoplay.');
        resetPlayers(true); // Reset to default placeholder if channel 1 doesn't exist
    }

    console.log('Player page initialized.');

});
