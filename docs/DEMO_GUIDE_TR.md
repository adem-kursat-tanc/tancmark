# TancMark Etkileşimli Demo

Codespaces demosu; gerçek TancMark metin, görsel, ses, Video Primary, Live, registry/imza ve C2PA kodunu yalnız kamuya uygun yapay örneklerle çalıştırır. Önceden hazırlanmış başarı cevabı kullanmaz; production sahipliği oluşturamaz ve production VAULT açamaz.

## Codespaces'te başlatma

1. README içindeki **Open in GitHub Codespaces** düğmesine basın.
2. En az 2 vCPU ve 8 GB RAM seçin; mümkünse **Prebuild ready** işaretli makineyi kullanın.
3. Hazır görüntü doğrulanır, demo başlar ve özel `4173` portu otomatik açılır.
4. English veya Türkçe seçip bir Çalıştır düğmesini ya da **TÜM DEMOLARI ÇALIŞTIR** seçeneğini kullanın.

Depoya özgü hızlı başlangıç adresi: `https://codespaces.new/adem-kursat-tanc/tancmark?quickstart=1`.

Codespaces hesabı, işlem/depolama kotası ve olası ücret kullanıcıya aittir. Bu sınırlı bir demodur; production kurulumu değildir.

## Sahip için prebuild kurulumu

İlk sahip-onaylı push sonrasında depoda **Settings → Codespaces → Prebuild configuration** bölümünden varsayılan `main` dalı ve `.devcontainer/devcontainer.json` için prebuild oluşturun; her push'ta güncelleme ve gerekli bölgeleri seçin. GitHub Actions açık kalmalıdır.

Ağır doğrulanmış bağımlılık kurulumu, yapay örnek üretimi, typecheck, build ve kaynak güvenliği kapısı `updateContentCommand` içinde çalışır ve GitHub prebuild görüntüsüne girer. Kullanıcı Codespace'i açınca yalnız hızlı `postCreateCommand` görüntü doğrulaması ve `postStartCommand` sunucu başlangıcı çalışır. Uygun prebuild yoksa Codespaces aynı ağır kurulumu kullanıcı açılışında yapar; bu yedek yol birkaç saniyelik diye sunulamaz.

GitHub yine de sanal makine ayırır, depolamayı geri getirir, depoyu klonlar ve tarayıcıyı bağlar. Bu nedenle 94 dakikalık yerel derlemeyi kullanıcı yolundan kaldırabiliriz; fakat GitHub altyapısının kesin kaç saniyede açılacağını dürüstçe garanti edemeyiz.

Yerel doğrulanmış Docker görüntüsünde hızlı görüntü kontrolü üç tekrarda 31–36 ms, sunucunun sağlık kontrolüne ulaşması 250–270 ms sürdü. Birleşik yerel hazır-görüntü yaşam döngüsü ortalama 292,333 ms, en yakın-sıra p95 değeri 303 ms oldu. GitHub sanal makine ayırma, görüntü aktarımı, depo eşitleme, tarayıcı bağlantısı ve port iletimi ölçülmedi; ayrıntı `reports/CODESPACES_PREBUILD_LOCAL_FAST_START_20260902.json` dosyasındadır.

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

Ayrıntılar: [güvenlik ve gizlilik](DEMO_SECURITY_AND_PRIVACY.md), [Linux demo profili](CODESPACES_LINUX_DEMO_PROFILE.md), [medya çalışma zamanı](DEMO_MEDIA_RUNTIME.md).
