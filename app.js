function createPlayerPanel(channel) {
 const oldPlayer = document.getElementById("playerPanel");

 if (oldPlayer) {
 destroyPlayer();
 }

 const playerPanel = document.createElement("section");
 playerPanel.id = "playerPanel";
 playerPanel.className = "player-panel";

 playerPanel.innerHTML = `
 <div class="player-header">
 <div>
 <p class="eyebrow">NOW PLAYING</p>
 <h3>${escapeHtml(channel.name || "Live channel")}</h3>
 </div>

 <button
 id="closePlayerBtn"
 class="secondary-btn"
 type="button"
 >
 Close player
 </button>
 </div>

 <video
 id="videoPlayer"
 controls
 autoplay
 playsinline
 preload="auto"
 crossorigin="anonymous"
 >
 Your browser cannot play this stream.
 </video>

 <p id="playerNote" class="player-note">
 Preparing the stream...
 </p>
 `;

 const contentSection =
 document.querySelector(".content-section");

 contentSection.insertBefore(
 playerPanel,
 contentSection.firstChild
 );

 return {
 panel: playerPanel,
 video: document.getElementById("videoPlayer"),
 note: document.getElementById("playerNote"),
 closeButton: document.getElementById("closePlayerBtn")
 };
}

function playLiveChannel(channel) {
 if (!channel || !channel.stream_id) {
 statusText.textContent =
 "This channel does not contain a valid stream ID.";
 return;
 }

 const hlsUrl = getStreamUrl(channel.stream_id, "m3u8");

 const originalExtension =
 channel.container_extension || "ts";

 const originalUrl = getStreamUrl(
 channel.stream_id,
 originalExtension
 );

 const player = createPlayerPanel(channel);
 const video = player.video;
 const note = player.note;

 let triedOriginalStream = false;
 let hls = null;

 currentHls = null;

 function setMessage(message, isError = false) {
 note.textContent = message;
 note.classList.toggle("error", isError);
 }

 function showFinalError() {
 setMessage(
 "Chrome received this channel request but could not play the stream. " +
 "Check DevTools Console and Network for CORS, HTTP, HLS, or codec errors.",
 true
 );

 statusText.textContent =
 "The channel is not compatible with browser playback.";
 }

 function tryOriginalStream() {
 if (triedOriginalStream) {
 showFinalError();
 return;
 }

 triedOriginalStream = true;

 if (hls) {
 hls.destroy();
 hls = null;
 }

 currentHls = null;

 setMessage(
 "HLS failed. Trying the provider's original stream format..."
 );

 video.removeAttribute("src");
 video.load();

 video.src = originalUrl;
 video.load();

 video.play().catch(() => {
 showFinalError();
 });
 }

 function startHlsWithJs() {
 if (!window.Hls || !Hls.isSupported()) {
 tryOriginalStream();
 return;
 }

 hls = new Hls({
 enableWorker: true,
 lowLatencyMode: true,
 xhrSetup: function(xhr) {
 xhr.withCredentials = false;
 }
 });

 currentHls = hls;

 hls.attachMedia(video);

 hls.on(Hls.Events.MEDIA_ATTACHED, () => {
 hls.loadSource(hlsUrl);
 });

 hls.on(Hls.Events.MANIFEST_PARSED, () => {
 setMessage("HLS playlist loaded. Starting playback...");

 video.play().catch(() => {
 showFinalError();
 });
 });

 hls.on(Hls.Events.ERROR, function(event, data) {
 console.error("HLS error:", data);

 if (!data.fatal) {
 return;
 }

 if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
 console.error("HLS network error:", data.details);
 }

 if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
 console.error("HLS media error:", data.details);
 }

 hls.destroy();
 hls = null;
 currentHls = null;

 tryOriginalStream();
 });
 }

 function startPlayback() {
 if (video.canPlayType("application/vnd.apple.mpegurl")) {
 video.src = hlsUrl;
 video.load();

 video.play().catch(() => {
 tryOriginalStream();
 });

 return;
 }

 startHlsWithJs();
 }

 video.addEventListener("error", () => {
 const mediaError = video.error;

 if (mediaError) {
 console.error("HTML video error:", {
 code: mediaError.code,
 message: mediaError.message
 });
 }

 if (!triedOriginalStream) {
 tryOriginalStream();
 } else {
 showFinalError();
 }
 });

 player.closeButton.addEventListener("click", () => {
 destroyPlayer();
 });

 statusText.textContent =
 `Opening: ${channel.name || "Live channel"}`;

 setMessage("Trying the provider's HLS stream...");

 player.panel.scrollIntoView({
 behavior: "smooth",
 block: "start"
 });

 startPlayback();
}

function destroyPlayer() {
 const playerPanel = document.getElementById("playerPanel");

 if (currentHls) {
 currentHls.destroy();
 currentHls = null;
 }

 if (!playerPanel) {
 return;
 }

 const video = playerPanel.querySelector("video");

 if (video) {
 video.pause();
 video.removeAttribute("src");
 video.load();
 }

 playerPanel.remove();

 statusText.textContent = "Player closed.";
}
