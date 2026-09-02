const csrf = document.querySelector('meta[name="csrf-token"]').content;
const routes = {
  text: ["/demo/text/seal", () => ({ text: document.querySelector("textarea").value })],
  image: ["/demo/image/seal", () => ({})],
  audio: ["/demo/audio/seal", () => ({ sampleRate: 44100 })],
  video: ["/demo/video/seal", () => ({})],
  registry: ["/demo/registry/verify", () => ({})],
  c2pa: ["/demo/c2pa/test-sign-verify", () => ({})],
};

const staticText = Object.freeze({
  en: {
    intro: "Try real deterministic watermarking with public synthetic examples. Nothing in this demo is a real ownership claim.",
    runAll: "RUN ALL DEMOS",
    reset: "RESET DEMO DATA",
    privacy: "Do not paste confidential, personal, or customer text. No file uploads, URLs, camera, or microphone access are accepted.",
    moduleText: "Text",
    moduleImage: "Image",
    moduleAudio: "Audio",
    moduleVideo: "Video",
    moduleLive: "Live",
    moduleRegistry: "Registry & Signature",
    run: "Run",
    runAudio: "Run 44.1/48 kHz",
    runLive: "Run 16s Live",
    demoText: "TancMark public synthetic demo text. This example contains no personal or customer data.",
  },
  tr: {
    intro: "Gerçek TancMark motorlarını herkese açık yapay örneklerle deneyin. Bu demo gerçek bir sahiplik iddiası oluşturmaz.",
    runAll: "TÜM DEMOLARI ÇALIŞTIR",
    reset: "DEMO VERİLERİNİ SIFIRLA",
    privacy: "Gizli, kişisel veya müşteriye ait metin yapıştırmayın. Dosya, bağlantı, kamera veya mikrofon yüklemesi kabul edilmez.",
    moduleText: "Metin",
    moduleImage: "Görsel",
    moduleAudio: "Ses",
    moduleVideo: "Video",
    moduleLive: "Canlı yayın",
    moduleRegistry: "Registry ve imza",
    run: "Çalıştır",
    runAudio: "44,1/48 kHz çalıştır",
    runLive: "16 sn canlı testi çalıştır",
    demoText: "TancMark herkese açık yapay demo metni. Bu örnek kişisel veya müşteriye ait veri içermez.",
  },
});

const moduleLabels = Object.freeze({
  en: { text: "Text", image: "Image", audio: "Audio", video: "Video", live: "Live", registry: "Registry and signature", c2pa: "C2PA" },
  tr: { text: "Metin", image: "Görsel", audio: "Ses", video: "Video", live: "Canlı yayın", registry: "Registry ve imza", c2pa: "C2PA" },
});

let currentLanguage = navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en";
const cardStates = new WeakMap();

initializeLanguageControls();
initializeResultCards();
applyLanguage(currentLanguage);

document.querySelectorAll("button[data-run]").forEach((button) => {
  button.addEventListener("click", () => run(button.dataset.run));
});
document.querySelector("#run-all").addEventListener("click", () => runAll());
document.querySelector("#reset-demo").addEventListener("click", () => resetDemo());

function initializeLanguageControls() {
  document.querySelectorAll("button[data-language]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.language));
  });
  const textarea = document.querySelector("textarea");
  textarea.dataset.userEdited = "false";
  textarea.addEventListener("input", () => { textarea.dataset.userEdited = "true"; });
}

function applyLanguage(language) {
  currentLanguage = language === "tr" ? "tr" : "en";
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = staticText[currentLanguage][element.dataset.i18n];
  });
  document.querySelectorAll("button[data-language]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage));
  });
  document.querySelectorAll(".technical-details > summary").forEach((label) => {
    label.textContent = localize("Show technical details", "Teknik ayrıntıları göster");
  });
  const textarea = document.querySelector("textarea");
  textarea.setAttribute("aria-label", localize("Demo text", "Demo metni"));
  if (textarea.dataset.userEdited !== "true") textarea.value = staticText[currentLanguage].demoText;
  document.querySelectorAll("article[data-module]").forEach((card) => rerenderCard(card));
}

function rerenderCard(card) {
  const state = cardStates.get(card);
  if (!state || state.kind === "idle") return renderIdle(card, false);
  if (state.kind === "running") return renderRunning(card, state.name, false);
  if (state.kind === "failure") return renderFailure(card, state.name, state.message, false);
  if (state.kind === "result") return renderResult(card, state.name, state.result, false);
}

function localize(english, turkish) {
  return currentLanguage === "tr" ? turkish : english;
}

function moduleLabel(name) {
  return moduleLabels[currentLanguage][name];
}

async function run(name) {
  const card = document.querySelector(`[data-module="${name}"]`);
  const output = card.querySelector("pre");
  const button = card.querySelector("button");
  output.textContent = localize("Running real engine…", "Gerçek motor çalışıyor…");
  renderRunning(card, name);
  button.disabled = true;
  try {
    if (name === "live") {
      await runLive(card, output);
      return;
    }
    if (name === "audio") {
      const audio44100 = await post("/demo/audio/seal", { sampleRate: 44100 });
      const audio48000 = await post("/demo/audio/seal", { sampleRate: 48000 });
      const result = { audio44100, audio48000 };
      output.textContent = summary(result);
      renderResult(card, name, result);
      return;
    }
    const [route, body] = routes[name];
    const result = await post(route, body());
    output.textContent = summary(result);
    renderResult(card, name, result);
    const preview = card.querySelector(".preview");
    if (preview && result.sealedPreviewDataUrl) preview.innerHTML = `<img alt="Synthetic sealed demo" src="${result.sealedPreviewDataUrl}">`;
    if (preview && result.previewDataUrl) preview.innerHTML = `<video controls muted src="${result.previewDataUrl}"></video>`;
  } catch (error) {
    output.textContent = `Failed safely: ${error.message}`;
    renderFailure(card, name, error.message);
  } finally {
    button.disabled = false;
  }
}

async function runAll() {
  const button = document.querySelector("#run-all");
  button.disabled = true;
  try {
    for (const name of ["text", "image", "audio", "video", "live", "registry", "c2pa"]) await run(name);
  } finally {
    button.disabled = false;
  }
}

async function resetDemo() {
  const button = document.querySelector("#reset-demo");
  button.disabled = true;
  try {
    await post("/demo/reset", {});
    document.querySelectorAll("article").forEach((card) => {
      card.querySelector("pre").textContent = localize("Ready", "Hazır");
      card.querySelector("details").open = false;
      renderIdle(card);
    });
    for (const name of ["image", "video"]) {
      document.querySelector(`[data-module="${name}"] .preview`).replaceChildren();
    }
    const liveVideo = document.querySelector("#live-player");
    liveVideo.pause();
    liveVideo.removeAttribute("src");
    liveVideo.load();
  } catch (error) {
    document.querySelector('[data-module="registry"] pre').textContent = localize(`Reset failed safely: ${error.message}`, `Sıfırlama güvenli biçimde başarısız oldu: ${error.message}`);
    renderFailure(document.querySelector('[data-module="registry"]'), "registry", error.message);
  } finally {
    button.disabled = false;
  }
}

async function runLive(card, output) {
  const started = await post("/demo/live/start", {});
  const video = card.querySelector("video");
  let playbackObserved = false;
  let hls;
  video.addEventListener("playing", () => { playbackObserved = true; }, { once: true });
  await waitForLiveManifest(started.playbackManifest);
  if (window.Hls && window.Hls.isSupported()) {
    hls = new window.Hls({
      lowLatencyMode: false,
      manifestLoadingMaxRetry: 20,
      manifestLoadingRetryDelay: 500,
      levelLoadingMaxRetry: 20,
      fragLoadingMaxRetry: 20,
    });
    hls.on(window.Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(started.playbackManifest));
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => void video.play());
    hls.attachMedia(video);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = started.playbackManifest;
    await video.play();
  } else {
    throw new Error("LIVE_BROWSER_HLS_NOT_SUPPORTED");
  }
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await delay(1500);
      const state = await getLiveStatus(playbackObserved);
      output.textContent = summary(state);
      renderResult(card, "live", state);
      if (state.status === "FAILED") throw new Error(state.error || "LIVE_DEMO_FAILED_SAFELY");
      if (state.status === "COMPLETED") {
        const result = await post("/demo/live/stop", {});
        output.textContent = summary(result);
        renderResult(card, "live", result);
        if (!result.livePlaybackVisible) throw new Error("LIVE_BROWSER_PLAYBACK_NOT_OBSERVED");
        return;
      }
    }
    throw new Error("LIVE_DEMO_STATUS_TIMEOUT");
  } finally {
    if (hls) hls.destroy();
  }
}

async function waitForLiveManifest(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" });
    await response.arrayBuffer();
    if (response.ok) return;
    if (response.status !== 404 && response.status !== 503) {
      throw new Error(`LIVE_MANIFEST_HTTP_${response.status}`);
    }
    await delay(500);
  }
  throw new Error("LIVE_MANIFEST_NOT_READY");
}

async function getLiveStatus(playbackObserved) {
  const response = await fetch("/demo/live/status", {
    method: "GET",
    credentials: "same-origin",
    headers: playbackObserved ? { "x-demo-playback-observed": "1" } : {},
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

async function post(route, body) {
  const response = await fetch(route, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      "x-demo-request-token": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function summary(result) {
  const clean = { ...result };
  delete clean.sealedText;
  delete clean.sealedPreviewDataUrl;
  delete clean.previewDataUrl;
  return JSON.stringify(clean, null, 2);
}

function initializeResultCards() {
  document.querySelectorAll("article[data-module]").forEach((card) => {
    const output = card.querySelector("pre");
    const details = document.createElement("details");
    details.className = "technical-details";
    const detailsLabel = document.createElement("summary");
    detailsLabel.textContent = localize("Show technical details", "Teknik ayrıntıları göster");
    output.replaceWith(details);
    details.append(detailsLabel, output);

    const panel = document.createElement("section");
    panel.className = "human-result human-result--idle";
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    details.before(panel);
    renderIdle(card);
  });
}

function renderIdle(card, remember = true) {
  const name = card.dataset.module;
  if (remember) cardStates.set(card, { kind: "idle" });
  renderPanel(card, {
    tone: "idle",
    title: localize(`${moduleLabel(name)} test is ready`, `${moduleLabel(name)} testi hazır`),
    description: localize(
      "Select Run to use the real demo engine with the prepared synthetic example.",
      "Çalıştır düğmesine bastığınızda gerçek demo motoru hazır yapay örnek üzerinde çalışır.",
    ),
    items: [],
  });
}

function renderRunning(card, name, remember = true) {
  if (remember) cardStates.set(card, { kind: "running", name });
  renderPanel(card, {
    tone: "running",
    title: localize(`${moduleLabel(name)} test is running…`, `${moduleLabel(name)} testi çalışıyor…`),
    description: name === "live"
      ? localize(
        "The 16-second stream is being processed. The final result appears after verification and safe shutdown.",
        "16 saniyelik yayın işleniyor. Kesin sonuç, yayın ve güvenli kapatma tamamlanınca gösterilecek.",
      )
      : localize("Watermarking, reading, and security checks are in progress.", "Mühürleme, okuma ve güvenlik kontrolleri yapılıyor."),
    items: [],
  });
}

function renderFailure(card, name, message, remember = true) {
  if (remember) cardStates.set(card, { kind: "failure", name, message });
  renderPanel(card, {
    tone: "failure",
    title: localize(`${moduleLabel(name)} test could not finish`, `${moduleLabel(name)} testi tamamlanamadı`),
    description: localize(
      "The system stopped safely; this result is not counted as a success.",
      "Sistem güvenli biçimde durdu; bu sonuç başarı sayılmaz.",
    ),
    items: [localize(`Technical error: ${message}`, `Teknik hata: ${message}`)],
  });
}

function renderResult(card, name, result, remember = true) {
  if (remember) cardStates.set(card, { kind: "result", name, result });
  if (result.status === "RUNNING" || result.status === "COMPLETED") {
    renderPanel(card, {
      tone: "running",
      title: localize("Live test is still running…", "Canlı yayın testi devam ediyor…"),
      description: localize("Final exact verification is not complete yet.", "Nihai exact doğrulama henüz tamamlanmadı."),
      items: [
        result.browserPlaybackVisible
          ? localize("The browser preview is visible.", "Tarayıcı ön izlemesi görüntüleniyor.")
          : localize("Waiting for the browser preview.", "Tarayıcı ön izlemesi bekleniyor."),
      ],
    });
    return;
  }

  const passed = modulePassed(name, result);
  renderPanel(card, {
    tone: passed ? "success" : resultStatus(result) === "DEMO_PARTIAL" ? "partial" : "failure",
    title: passed
      ? localize(`${moduleLabel(name)} test passed`, `${moduleLabel(name)} testi başarılı`)
      : resultStatus(result) === "DEMO_PARTIAL"
        ? localize(`${moduleLabel(name)} test returned a partial result`, `${moduleLabel(name)} testi kısmi sonuç verdi`)
        : localize(`${moduleLabel(name)} test did not pass the success gate`, `${moduleLabel(name)} testi başarı kapısını geçemedi`),
    description: passed
      ? localize(
        "The watermark and security checks returned the expected result. This is a safe demo only; it does not create production ownership or open a real VAULT.",
        "Mühür ve güvenlik kontrolleri beklenen sonucu verdi. Bu yalnız güvenli demodur; gerçek üretim sahipliği veya VAULT açılmaz.",
      )
      : localize(
        "The measured result below was not relabeled as a success. Review the technical details.",
        "Aşağıdaki gerçek ölçüm başarı olarak yeniden adlandırılmadı. Teknik ayrıntıları inceleyin.",
      ),
    items: resultItems(name, result),
  });
}

function modulePassed(name, result) {
  if (name === "audio") {
    const runs = [result.audio44100, result.audio48000];
    return runs.every((run) =>
      run?.status === "DEMO_EXACT_VERIFIED" &&
      run.audioExactRecovered === true &&
      run.registryMatch === true &&
      run.signatureVerified === true &&
      run.audioWrongIdOwnership === false &&
      run.audioNoIdOwnership === false &&
      run.audioSampleCountPreserved === true
    );
  }
  if (result.status !== "DEMO_EXACT_VERIFIED") return false;
  if (name === "text") {
    return result.physicalRecovery === true && result.registryMatch === true && result.signatureVerified === true &&
      result.wrongIdOwnership === false && result.noIdOwnership === false;
  }
  if (name === "image") {
    return result.payloadBytesExact === "4/4" && result.strongFinderCount >= 1 && result.registryMatch === true &&
      result.signatureVerified === true && result.wrongIdOwnership === false && result.noIdOwnership === false;
  }
  if (name === "video") {
    return result.videoExactRecovered === true && result.registryMatch === true && result.signatureVerified === true &&
      result.videoWrongIdOwnership === false && result.videoNoIdOwnership === false && result.videoFrameDrop === 0 &&
      result.videoDuplicateFrame === 0 && result.videoCumulativeDrift === 0;
  }
  if (name === "live") {
    return result.liveFinalExactVerified === true && result.registryMatch === true && result.signatureVerified === true &&
      result.liveWrongOwnership === false && result.liveWrongTenantOwnership === false &&
      result.liveUnwatermarkedInjectionOwnership === false && result.liveDroppedFrames === 0 &&
      result.liveProcessedFrames === result.liveExpectedFrames;
  }
  if (name === "registry") {
    return result.registryMatch === true && result.signatureVerified === true && result.wrongTenantOwnership === false &&
      result.changedRegistryRecordAccepted === false && result.wrongSignatureAccepted === false;
  }
  if (name === "c2pa") {
    return result.signEmbed === true && result.rereadSignatureValid === true && result.rereadAssetIntegrityValid === true &&
      result.tamperDetected === true && result.registryMatch === true && result.signatureVerified === true;
  }
  return false;
}

function resultStatus(result) {
  if (result.status) return result.status;
  const runs = [result.audio44100, result.audio48000].filter(Boolean);
  if (runs.length > 0 && runs.every((run) => run.status === "DEMO_EXACT_VERIFIED")) return "DEMO_EXACT_VERIFIED";
  if (runs.some((run) => run.status === "DEMO_PARTIAL")) return "DEMO_PARTIAL";
  return "DEMO_NOT_FOUND";
}

function resultItems(name, result) {
  if (name === "audio") {
    const a = result.audio44100;
    const b = result.audio48000;
    return [
      `${localize("44.1", "44,1")} kHz: ${plainStatus(a.status)} (${formatDuration(a.durationMs)}).`,
      `48 kHz: ${plainStatus(b.status)} (${formatDuration(b.durationMs)}).`,
      truthLine(
        a.audioSampleCountPreserved && b.audioSampleCountPreserved,
        localize("Sample counts and formats were preserved for both audio files.", "Her iki seste de örnek sayısı ve biçim korundu."),
        localize("An audio sample count or format was not preserved.", "Ses örnek sayısı veya biçimi korunamadı."),
      ),
      truthLine(
        a.registryMatch && b.registryMatch && a.signatureVerified && b.signatureVerified,
        localize("Registry records and digital signatures were verified.", "Registry kayıtları ve dijital imzalar doğrulandı."),
        localize("Registry or signature verification did not complete.", "Registry veya imza doğrulaması tamamlanamadı."),
      ),
      truthLine(
        !a.audioWrongIdOwnership && !b.audioWrongIdOwnership && !a.audioNoIdOwnership && !b.audioNoIdOwnership,
        localize("Wrong-ID and no-ID inputs were rejected.", "Yanlış kimlik ve kimliksiz girişler reddedildi."),
        localize("A negative identity check failed.", "Negatif kimlik kontrolü geçmedi."),
      ),
    ];
  }
  if (name === "text") return [
    truthLine(result.physicalRecovery, localize("The watermark was recovered exactly.", "Mühür tam olarak okundu."), localize("The watermark was not recovered exactly.", "Mühür tam olarak okunamadı.")),
    verificationLine(result),
    truthLine(!result.wrongIdOwnership && !result.noIdOwnership, localize("Wrong-ID and no-ID inputs were rejected.", "Yanlış kimlik ve kimliksiz girişler reddedildi."), localize("A negative identity check failed.", "Negatif kimlik kontrolü geçmedi.")),
    localize(`Engine time: ${formatDuration(result.durationMs)}.`, `Motor süresi: ${formatDuration(result.durationMs)}.`),
  ];
  if (name === "image") return [
    localize(`Watermark payload: ${result.payloadBytesExact}; strong physical finding: ${result.strongFinderResult}.`, `Mühür verisi: ${result.payloadBytesExact}; güçlü fiziksel bulgu: ${result.strongFinderResult}.`),
    verificationLine(result),
    truthLine(!result.wrongIdOwnership && !result.noIdOwnership, localize("Wrong-ID and no-ID inputs were rejected.", "Yanlış kimlik ve kimliksiz girişler reddedildi."), localize("A negative identity check failed.", "Negatif kimlik kontrolü geçmedi.")),
    localize(`Engine time: ${formatDuration(result.durationMs)}.`, `Motor süresi: ${formatDuration(result.durationMs)}.`),
  ];
  if (name === "video") return [
    truthLine(result.videoExactRecovered, localize("The video watermark was recovered exactly.", "Video mühürü tam olarak okundu."), localize("The video watermark was not recovered exactly.", "Video mühürü tam olarak okunamadı.")),
    verificationLine(result),
    truthLine(!result.videoWrongIdOwnership && !result.videoNoIdOwnership, localize("Wrong-ID and no-ID videos were rejected.", "Yanlış kimlik ve kimliksiz video reddedildi."), localize("A negative video identity check failed.", "Negatif video kimlik kontrolü geçmedi.")),
    localize(
      `Dropped frames: ${result.videoFrameDrop}; duplicate frames: ${result.videoDuplicateFrame}; timing drift: ${result.videoCumulativeDrift}.`,
      `Kayıp kare: ${result.videoFrameDrop}; yinelenen kare: ${result.videoDuplicateFrame}; zaman kayması: ${result.videoCumulativeDrift}.`,
    ),
    localize(`Engine time: ${formatDuration(result.durationMs)}.`, `Motor süresi: ${formatDuration(result.durationMs)}.`),
  ];
  if (name === "live") return [
    truthLine(result.liveFinalExactVerified, localize("The live-stream watermark was verified exactly.", "Canlı yayın mühürü kesin olarak doğrulandı."), localize("The live-stream watermark was not verified exactly.", "Canlı yayın mühürü kesin doğrulanamadı.")),
    localize(`Processed frames: ${result.liveProcessedFrames}/${result.liveExpectedFrames}; dropped frames: ${result.liveDroppedFrames}.`, `İşlenen kare: ${result.liveProcessedFrames}/${result.liveExpectedFrames}; kayıp kare: ${result.liveDroppedFrames}.`),
    truthLine(result.liveBothChannelsMatched, localize("The primary and supporting channels matched the same identity.", "Ana kanal ve destek kanalı aynı kimlikle eşleşti."), localize("The two channels did not match together.", "İki kanal birlikte eşleşmedi.")),
    verificationLine(result),
    truthLine(
      !result.liveWrongOwnership && !result.liveWrongTenantOwnership && !result.liveUnwatermarkedInjectionOwnership,
      localize("Wrong identity, wrong tenant, and unwatermarked content were rejected.", "Yanlış kimlik, yanlış kullanıcı ve mühürsüz içerik reddedildi."),
      localize("A live-stream negative security check failed.", "Canlı yayın negatif güvenlik kontrolü geçmedi."),
    ),
    localize(`Total time: ${formatDuration(result.durationMs)}.`, `Toplam süre: ${formatDuration(result.durationMs)}.`),
  ];
  if (name === "registry") return [
    verificationLine(result),
    truthLine(!result.wrongTenantOwnership, localize("The wrong tenant was rejected.", "Yanlış kullanıcı/tenant reddedildi."), localize("The wrong-tenant check failed.", "Yanlış kullanıcı/tenant kontrolü geçmedi.")),
    truthLine(!result.changedRegistryRecordAccepted && !result.wrongSignatureAccepted, localize("The modified record and wrong signature were rejected.", "Değiştirilmiş kayıt ve yanlış imza reddedildi."), localize("A registry or signature negative check failed.", "Kayıt veya imza negatif kontrolü geçmedi.")),
  ];
  if (name === "c2pa") return [
    truthLine(result.signEmbed && result.rereadSignatureValid && result.rereadAssetIntegrityValid, localize("C2PA data was embedded, reread, and verified.", "C2PA bilgisi eklendi ve yeniden okunarak doğrulandı."), localize("The C2PA signature or integrity check failed.", "C2PA imza veya bütünlük kontrolü geçmedi.")),
    truthLine(result.tamperDetected, localize("Content tampering was detected successfully.", "İçerik değişikliği başarıyla tespit edildi."), localize("Content tampering was not detected.", "İçerik değişikliği tespit edilemedi.")),
    verificationLine(result),
    truthLine(result.c2paCanOpenVault === false, localize("C2PA did not open VAULT by itself.", "C2PA tek başına VAULT açmadı."), localize("The C2PA authority boundary returned an unexpected result.", "C2PA yetki sınırı beklenmeyen sonuç verdi.")),
    localize(`Engine time: ${formatDuration(result.durationMs)}.`, `Motor süresi: ${formatDuration(result.durationMs)}.`),
  ];
  return [localize(`Technical status: ${resultStatus(result)}.`, `Teknik durum: ${resultStatus(result)}.`)];
}

function verificationLine(result) {
  return truthLine(
    result.registryMatch && result.signatureVerified,
    localize("The registry record and digital signature were verified.", "Registry kaydı ve dijital imza doğrulandı."),
    localize("The registry record or digital signature was not verified.", "Registry veya dijital imza doğrulanamadı."),
  );
}

function truthLine(condition, yes, no) {
  return condition ? yes : no;
}

function plainStatus(status) {
  if (status === "DEMO_EXACT_VERIFIED") return localize("exactly verified", "tam doğrulandı");
  if (status === "DEMO_PARTIAL") return localize("partial result", "kısmi sonuç");
  return localize("not verified", "doğrulanamadı");
}

function formatDuration(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return localize("not measured", "ölçülmedi");
  const locale = currentLanguage === "tr" ? "tr-TR" : "en-US";
  if (value >= 1000) return `${(value / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} ${localize("seconds", "saniye")}`;
  return `${Math.round(value).toLocaleString(locale)} ms`;
}

function renderPanel(card, { tone, title, description, items }) {
  const panel = card.querySelector(".human-result");
  panel.className = `human-result human-result--${tone}`;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = description;
  panel.replaceChildren(heading, copy);
  if (items.length > 0) {
    const list = document.createElement("ul");
    for (const item of items) {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.append(listItem);
    }
    panel.append(list);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
