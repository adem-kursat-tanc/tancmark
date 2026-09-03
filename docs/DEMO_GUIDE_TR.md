# TancMark Deneysel Yerel Demo

Durum: `EXPERIMENTAL_LOCAL_DEMO`.

Yerel/Docker demosu; gerçek TancMark metin, görsel, ses, Video Primary, Live, registry/imza ve C2PA kodunu yalnız kamuya uygun yapay örneklerle çalıştırır. Önceden hazırlanmış başarı cevabı kullanmaz; production sahipliği oluşturamaz ve production VAULT açamaz.

## Kullanılabilirlik

**GitHub Codespaces hosted demo currently unavailable.** Barındırılan deneme, görüntü derlemesinden sonra kurtarma moduna geçti; önbellekli yeniden oluşturma da gözlenen 11 dakika 14 saniye içinde hazır olmadı. Başarısız barındırılan yol yayın kapısı değildir. Bu depo Codespaces düğmesi, hızlı başlangıç bağlantısı, ücretli prebuild, ücretli makine veya barındırılan açılış süresi garantisi yayımlamaz.

Demo kodu, çalışma zamanını kontrol eden operatörler için deneysel yerel/Docker kullanımına açık tutulur. `.devcontainer` dosyaları derleme ve güvenlik sınırı kaynağı olarak korunur; çalışan bir GitHub-hosted Codespaces başlatma iddiası değildir. Yerel ölçümleri GitHub barındırılan açılış süresi gibi sunmayın.

## Yerel/Docker kanıt sınırı

Sınırlı yerel/Docker fixture, işlev, güvenlik, C2PA, Live, temizlik ve tarayıcı görünürlük testleri kayıtlı Linux profilinde geçti. Önceden hazırlanmış yerel Docker görüntüsünde görüntü doğrulaması üç tekrarda 31–36 ms, sunucunun sağlık kontrolüne ulaşması 250–270 ms sürdü. Birleşik hazır-görüntü yaşam döngüsü ortalama 292,333 ms, en yakın-sıra p95 değeri 303 ms oldu. Bu değerler görüntü yapımını, GitHub makine ayırmasını, görüntü aktarımını, depo eşitlemesini, tarayıcı bağlantısını ve port iletimini içermez; ayrıntılar `reports/CODESPACES_PREBUILD_LOCAL_FAST_START_20260902.json` ve `reports/GITHUB_CODESPACES_HOSTED_DEMO_STATUS_20260902.json` dosyalarındadır.

Yerel çalıştırma deneysel bir operatör akışıdır. `4173` portunu loopback/özel erişime bağlı tutun, yalnız üretilmiş kamu fixture'larını kullanın ve `.devcontainer/start-demo.sh` içindeki ortam allowlist'i ile `DEMO_ONLY` sınırını koruyun.

## Gerçekte çalışan modüller

- Metin: mühür, kör okuma, yanlış ID ve no-ID kontrolü.
- Görsel: 512×512 yapay PNG üzerinde gerçek mühürleme ve mevcut `INFORMED_REFERENCE_PATCH` (bilgilendirilmiş referans yamalı) okuma; kör görsel okuma iddiası yoktur.
- Ses: 44.1 kHz ve 48 kHz stereo WAV mühürleme/okuma, örnek sayısı kontrolü.
- Video: FFV1 + PCM Matroska üzerinde gerçek Video Primary, kare/PTS/ses bütünlüğü.
- Live: 1× yayın besleme, akış sırasında mühürleme, RTSP → MediaMTX → HLS tarayıcı oynatımı, kayıpsız final kayıt ve exact doğrulama.
- Registry ve imza: her başlangıçta geçici kayıt ve geçici ML-DSA test anahtarı.
- C2PA: yapay PNG inceleme, geçici ES256 imzalama/gömme, yeniden okuma, doğrulama ve bozma tespiti.

Video önizlemesi VP9 + Opus WebM, Live oynatımı VP9 + Opus parçalı-MP4 HLS kullanır. Önizleme sahiplik karar kaynağı değildir. Live final kararı, aynı mühürlü karelerden eşzamanlı üretilen kayıpsız FFV1 + PCM kaydı üzerinden verilir.

Görsel kartı gerçek fiziksel motoru çalıştırır; ancak mevcut kamu okuyucusu temiz referans yamalarını ve beklenen anahtarlı adayı kullandığı için bu sonuç kör okuma diye sunulmaz. Arayüz okuma biçimini açıkça `INFORMED_REFERENCE_PATCH` olarak gösterir. Bu sınırlı demoda kör okuma yapan kart metindir.

## Gizlilik

Gizli, kişisel veya müşteri metni yapıştırmayın. Metin alanı en fazla 2.000 Unicode karakterdir; loglanmaz ve kalıcı tutulmaz. Dosya yükleme, yerel dosya yolu, dış URL, kamera, mikrofon, dış canlı yayın, production registry/anahtar, analiz ve telemetri yoktur.

Her sonuç `DEMO_ONLY` olarak gösterilir. Exact demo sonucu yalnız geçici demo kaydının ve test imzasının doğrulandığı anlamına gelir; gerçek sahip doğrulandığı anlamına gelmez.

## Ölçülen sınırlı profil

Gerçek Ubuntu Linux testinde metin, görsel, iki ses oranı, video, registry/imza, C2PA, temizlik ve tarayıcıda görünen Live 3/3 geçti. Live 384/384 kare işledi; düşen kare 0, final kuyruk 0 kaldı. Üç uçtan uca süre 52,612 sn, 24,744 sn ve 22,631 sn idi. 16 saniyelik kaynak 1× gerçek zamanda beslendi; final fiziksel doğrulama kayıt kapandıktan sonra çalıştı.

Ayrıntılar: [güvenlik ve gizlilik](DEMO_SECURITY_AND_PRIVACY.md), [Linux demo profili](CODESPACES_LINUX_DEMO_PROFILE.md), [medya çalışma zamanı](DEMO_MEDIA_RUNTIME.md) ve [barındırılan demo durum raporu](../reports/GITHUB_CODESPACES_HOSTED_DEMO_STATUS_20260902.json).
