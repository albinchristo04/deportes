document.addEventListener('DOMContentLoaded', () => {
    const iframePlayer = document.getElementById('iframe-player');
    const hlsPlayer = document.getElementById('hls-player');
    const playerContainer = document.getElementById('player-container');
    const playerPlaceholder = document.getElementById('player-placeholder');
    const channelButtons = document.querySelectorAll('.channel-btn');
    const m3u8UrlInput = document.getElementById('m3u8-url-input');
    const loadM3u8Btn = document.getElementById('load-m3u8-btn');

    let hls = null; // Variable to hold the Hls.js instance

    // Function to hide all players and show placeholder
    function resetPlayers() {
        if (hls) {
            hls.destroy(); // Destroy previous HLS instance if exists
            hls = null;
        }
        iframePlayer.style.display = 'none';
        iframePlayer.src = 'about:blank'; // Stop iframe loading
        hlsPlayer.style.display = 'none';
        hlsPlayer.pause();
        hlsPlayer.removeAttribute('src'); // Remove src to prevent potential background loading
        playerPlaceholder.style.display = 'block';
    }

    // Function to display the iframe player
    function showIframePlayer(iframeSrc) {
        resetPlayers();
        playerPlaceholder.style.display = 'none';
        iframePlayer.src = iframeSrc;
        iframePlayer.style.display = 'block';
        console.log(`Loading Iframe: ${iframeSrc}`);
    }

    // Function to display the HLS.js player
    function showHlsPlayer(m3u8Src) {
        resetPlayers();
        playerPlaceholder.style.display = 'none';
        hlsPlayer.style.display = 'block';
        console.log(`Loading M3U8: ${m3u8Src}`);

        if (Hls.isSupported()) {
            console.log("HLS.js is supported. Initializing...");
            hls = new Hls();
             hls.on(Hls.Events.ERROR, function (event, data) {
                console.error('HLS.js Error:', data);
                // Handle specific errors if needed
                if (data.fatal) {
                    switch(data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error('Fatal network error encountered, trying to recover...');
                        // hls.startLoad(); // Optional: try to recover
                        alert("Network error loading stream. Please check the URL or your connection.");
                        resetPlayers(); // Show placeholder again on fatal error
                        break;
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error('Fatal media error encountered, trying to recover...');
                        // hls.recoverMediaError(); // Optional: try to recover
                         alert("Media error playing stream. The stream might be invalid or offline.");
                        resetPlayers();
                        break;
                      default:
                        // Cannot recover
                        console.error('Unrecoverable HLS.js error.');
                        alert("An unrecoverable error occurred with the stream.");
                        hls.destroy();
                        resetPlayers();
                        break;
                    }
                }
            });
            hls.loadSource(m3u8Src);
            hls.attachMedia(hlsPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                console.log("Manifest parsed, attempting to play...");
                hlsPlayer.play().catch(e => console.error("Autoplay prevented:", e));
            });
        } else if (hlsPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (mostly Safari)
            console.log("Native HLS support detected.");
            hlsPlayer.src = m3u8Src;
            hlsPlayer.addEventListener('loadedmetadata', function() {
                 hlsPlayer.play().catch(e => console.error("Autoplay prevented:", e));
            });
             hlsPlayer.addEventListener('error', function(e) {
                 console.error('Native HLS Error:', e);
                 alert("Error loading stream. Please check the URL or try a different browser/stream.");
                 resetPlayers();
             });
        } else {
            console.error("HLS is not supported in this browser.");
            alert("Sorry, HLS streaming is not supported in your browser.");
            resetPlayers();
        }
    }

    // Event Listeners for Channel Buttons
    channelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const iframeSrc = button.getAttribute('data-iframe-src');
            if (iframeSrc && iframeSrc !== 'YOUR_CHANNEL_1_IFRAME_URL_HERE' && iframeSrc !== 'YOUR_CHANNEL_2_IFRAME_URL_HERE') { // Basic check for placeholder
                showIframePlayer(iframeSrc);
            } else {
                alert('Channel URL is not configured.');
                 resetPlayers();
            }
        });
    });

    // Event Listener for Load M3U8 Button
    loadM3u8Btn.addEventListener('click', () => {
        const m3u8Url = m3u8UrlInput.value.trim();
        if (m3u8Url && (m3u8Url.endsWith('.m3u8') || m3u8Url.includes('m3u8'))) { // Basic validation
             // Simple validation for http/https
            if (!m3u8Url.startsWith('http://') && !m3u8Url.startsWith('https://')) {
                alert('Please enter a valid M3U8 URL starting with http:// or https://');
                return;
            }
            showHlsPlayer(m3u8Url);
        } else {
            alert('Please enter a valid M3U8 URL.');
             resetPlayers();
        }
    });

    // Initial state - Show placeholder
    resetPlayers();

});