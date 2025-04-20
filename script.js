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

    function showPlaceholder() {
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

    function resetPlayers(showDefaultPlaceholder = true) {
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
        iframePlayer.src = 'about:blank'; // More reliable way to stop loading

        // Reset HLS Player
        hlsPlayer.style.display = 'none';
        hlsPlayer.pause();
        hlsPlayer.removeAttribute('src'); // Important!
        hlsPlayer.load(); // Reset the media element state

        // Manage Placeholder visibility
        if (showDefaultPlaceholder) {
            showPlaceholder();
        } else {
            hidePlaceholder(); // Keep placeholder hidden if starting a new load
        }

        currentStreamType = null;
        currentStreamSrc = null;
    }

    function displayError(message, isFatal = false) {
        hideLoader(); // Ensure loader is hidden on error
        console.error("Stream Error:", message);
        alert(`Error: ${message}`); // Simple alert for now
        // Optional: Display error message within the player area
        if (isFatal) {
             resetPlayers(true); // Show placeholder on fatal error
             setActiveButton(null); // Deactivate button if stream fails completely
        }
    }

    // --- Player Loading Logic ---

    function loadIframeStream(iframeSrc, buttonElement) {
        if (currentStreamSrc === iframeSrc && currentStreamType === 'iframe') {
            console.log('Iframe stream already loaded.');
            return; // Don't reload the same source
        }
        resetPlayers(false); // Reset but keep placeholder hidden initially
        showLoader();
        setActiveButton(buttonElement); // Mark button active immediately

        currentStreamType = 'iframe';
        currentStreamSrc = iframeSrc;

        iframePlayer.onload = () => {
            console.log(`Iframe loaded: ${iframeSrc}`);
            hideLoader();
            hidePlaceholder();
            iframePlayer.style.display = 'block';
        };
        iframePlayer.onerror = () => {
            displayError(`Failed to load iframe content from ${iframeSrc}. The source might be blocking embedding.`, true);
        };

        console.log(`Attempting to load Iframe: ${iframeSrc}`);
        iframePlayer.src = iframeSrc; // Set src *after* attaching handlers
    }

    function loadHlsStream(m3u8Src) {
        if (currentStreamSrc === m3u8Src && currentStreamType === 'hls') {
            console.log('HLS stream already loaded.');
            return; // Don't reload the same source
        }
        resetPlayers(false);
        showLoader();
        setActiveButton(null); // No button associated with manual M3U8 load initially

        currentStreamType = 'hls';
        currentStreamSrc = m3u8Src;

        console.log(`Attempting to load M3U8: ${m3u8Src}`);

        if (Hls.isSupported()) {
            console.log("HLS.js is supported. Initializing...");
            hls = new Hls({
                // Optional: Configure HLS.js (e.g., retry delays, buffer sizes)
                // enableWorker: true, // Can improve performance but check browser compatibility
                // lowLatencyMode: true, // For low latency streams
            });

            // Attach listeners before loading source
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
                        userMessage = `Network error: Could not load stream segment. Check connection or stream status. Details: ${data.details}`;
                        // You might try recovery here for non-fatal network errors
                        // if (!data.fatal) hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        userMessage = `Media error: Problem decoding stream content. The stream might be corrupt or incompatible. Details: ${data.details}`;
                         // Attempt recovery for specific media errors if applicable
                         // if (data.details === 'bufferStalledError' && !data.fatal) hls.recoverMediaError();
                        break;
                    case Hls.ErrorTypes.MUX_ERROR:
                        userMessage = `Mux error: Problem parsing the stream container. Details: ${data.details}`;
                        break;
                     case Hls.ErrorTypes.OTHER_ERROR:
                         userMessage = `An unexpected error occurred. Details: ${data.details}`;
                        break;
                    default:
                         userMessage = `An unexpected HLS error occurred (${data.type}).`;
                }
                displayError(userMessage, data.fatal); // Only reset player fully if fatal
                if(data.fatal && hls) { // Destroy instance on fatal error
                    hls.destroy();
                    hls = null;
                }
            });

            hls.loadSource(m3u8Src);
            hls.attachMedia(hlsPlayer);

        } else if (hlsPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari, iOS)
            console.log("Native HLS support detected.");

            hlsPlayer.onloadedmetadata = () => {
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
                 // Extract more specific error if possible
                 let message = "Failed to load or play the stream using native HLS.";
                 if (hlsPlayer.error) {
                     switch (hlsPlayer.error.code) {
                         case MediaError.MEDIA_ERR_ABORTED: message = 'Video playback aborted.'; break;
                         case MediaError.MEDIA_ERR_NETWORK: message = 'A network error caused video download to fail.'; break;
                         case MediaError.MEDIA_ERR_DECODE: message = 'Video playback aborted due to a corruption problem or unsupported codec.'; break;
                         case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: message = 'The video source is not supported.'; break;
                         default: message = `An unknown video error occurred (Code: ${hlsPlayer.error.code})`;
                     }
                 }
                displayError(message, true);
                // Cleanup event listeners to prevent duplicates
                hlsPlayer.onerror = null;
                hlsPlayer.onloadedmetadata = null;
            };

            hlsPlayer.src = m3u8Src;
             hlsPlayer.load(); // Trigger loading


        } else {
            displayError("Sorry, HLS streaming is not supported in this browser.", true);
        }
    }


    // --- Event Listeners Setup ---

    // Channel Button Clicks
    channelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const iframeSrc = button.getAttribute('data-iframe-src');
             // Simple check to prevent loading placeholder text
             if (iframeSrc && !iframeSrc.startsWith('YOUR_CHANNEL_')) {
                loadIframeStream(iframeSrc, button);
            } else {
                alert('This channel URL is not configured yet.');
                resetPlayers(true);
                setActiveButton(null);
            }
        });
    });

    // M3U8 Form Submission
    m3u8Form.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent page reload
        const m3u8Url = m3u8UrlInput.value.trim();

        if (m3u8Url) {
            // More robust URL validation
             try {
                const url = new URL(m3u8Url); // Check if it's a valid URL structure
                if (url.protocol !== "http:" && url.protocol !== "https:") {
                    throw new Error("Invalid protocol");
                }
                 if (!url.pathname.toLowerCase().endsWith('.m3u8') && !url.search.toLowerCase().includes('m3u8')) {
                     // Allow URLs without explicit .m3u8 if they look plausible
                     console.warn("URL does not end with .m3u8, attempting to load anyway.");
                 }
                 loadHlsStream(m3u8Url);
                 // Optionally clear input after successful initiation attempt:
                 // m3u8UrlInput.value = '';
             } catch (error) {
                 alert('Invalid M3U8 URL. Please enter a valid URL starting with http:// or https://.');
                 console.error("Invalid URL entered:", error);
                 resetPlayers(true); // Keep placeholder if invalid URL entered
                 setActiveButton(null);
             }

        } else {
            alert('Please enter an M3U8 Stream URL.');
        }
    });

    // --- Initial State ---
    resetPlayers(true); // Show the placeholder on initial load
    console.log('Player page initialized.');

});
