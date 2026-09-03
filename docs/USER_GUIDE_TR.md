# TancMark Kullanıcı Kılavuzu

TancMark, deterministik mühürleme ve içerik geçmişi çalışmaları için Node.js/TypeScript tabanlı, kendi sunucunuzda çalıştırılan bir kaynak uygulamasıdır. Metin, görsel, ses, video ve korumalı yerel Live akışlarında sinyal mühürleyip geri okuyabilir. Fiziksel sinyal okumayı kimlik ve sahiplik yetkisinden ayrı tutar.

Amacınıza uygun yolu seçin:

- TancMark'ın ne yaptığını öğrenmek: [TancMark nedir?](#tancmark-nedir), [Temel kavramlar](#temel-kavramlar) ve [Sonuçlar](#sonuçlar).
- Kaynak kodu indirip temel testleri çalıştırmak: [Kaynak kurulumu](#kaynak-kurulumu).
- Yerel sunucuyu çalıştırmak: [Sunucuyu başlatma](#sunucuyu-başlatma).
- Metin, görsel, ses veya video ile çalışmak: [Medya modüllerini kullanma](#medya-modüllerini-kullanma).
- Yerel canlı yayını korumak: [Live](#live).
- C2PA bilgisi okumak veya eklemek: [C2PA](#c2pa).
- Sonucu anlamak: [Sonuçlar](#sonuçlar) ve [Sonuçlar ve terimler](RESULTS_AND_TERMS_TR.md).
- Hata çözmek: [Sorun giderme](TROUBLESHOOTING_TR.md).

## TancMark nedir?

TancMark bir çalışma kopyasına deterministik kimlik veya destek izi gömer, gelen kopyadaki fiziksel kanıtı okur ve tam sonucu tenant'a bağlı kayıt ile dijital imzaya karşı doğrulayabilir.

Geliştiriciler, teknik operatörler, inceleme uzmanları, yayıncılar ve kendi sunucusunu işletip kayıtlarla anahtarları koruyabilen kurumlar için uygundur. Teknik olmayan son kullanıcı genellikle bir operatörün kurduğu TancMark sunucusunu veya arayüzünü kullanır.

Güncel kamu kaynağında TypeScript çekirdeği, API sunucusu, panel, üretilmiş istemciler, Video Primary, yerel korumalı Live, C2PA desteği, DNA danışman bileşenleri, doğrulama programları ve kişisel bilgiden arındırılmış test kanıtları bulunur.

## TancMark ne değildir?

Bu depo hazır kurulan masaüstü veya mobil uygulama değildir. Tarayıcı/WebAssembly portu değildir. Tek başına hukuki sahiplik ispatı ya da resmî C2PA uygunluğu vermez; zayıf kanıtı kesin sonuca dönüştürmez.

YouTube, Twitch, dış RTMP, OAuth, webhook, CDN, DRM, ödeme, üretim TLS'i, ortak veri deposu ve üretim kuyrukları hazır bağlı değildir. İhtiyaç duyan operatör bunları ayrıca yapılandırıp test eder.

## Güncel kamu sürümünün durumu

- Metin, görsel, ses, Video Primary, yerel korumalı Live, kayıt/imza denetimi, DNA/Chief Brain danışman davranışı ve C2PA okuma/doğrulama/imzalama/gömme için test edilmiş yerel yollar vardır.
- Videonun dondurulmuş ileri fiziksel matrisi 16 hücrenin 14'ünü geçti. Kalan iki durum güvenli biçimde durur ve sınır olarak kalır.
- Yerel korumalı Live, Windows'taki dondurulmuş gerçek medya ve nihai tam doğrulama kapılarını geçti.
- C2PA için PNG, JPEG, MP4 ve MOV yerelde test edildi. PDF ve WAV C2PA ürün desteği `NOT_MEASURED` durumundadır ve reddedilir.
- Windows gerçek yerel testlerle doğrulandı. Linux CI, sahibin ilk GitHub gönderiminden sonra ayrıca doğrulanacaktır. macOS test edilmedi.

Kesin sınırlar için [Özellik Durumu](FEATURE_STATUS.md) ile modül bazlı [dayanıklılık kanıtlarına](DOCUMENTATION_INDEX.md#robustness-evidence) bakın.

## Temel kavramlar

Normal akış:

```text
SEAL -> RECOVER -> MATCH -> VERIFY
```

- **SEAL (mühürle):** Çalışma kopyasına deterministik kimlik veya iz gömer.
- **RECOVER (geri oku):** Gelen kopyadaki mühür veya kimlik sinyalini okur.
- **MATCH (eşleştir):** Okunan değeri yetkili kayıt ya da sınırlı aday havuzuyla karşılaştırır.
- **VERIFY (doğrula):** Tekil kayıt, tenant/hesap bağı ve dijital imzayı denetler.

### Blind yani kör okuma nedir?

Kör okuma, okuyucunun mühürsüz orijinal dosyaya ihtiyaç duymaması demektir. Her zaman “başka hiçbir girdi yok” anlamına gelmez. Modüle göre anahtar, beklenen kimlik, aday havuzu, taşıyıcı biçimi, imzalı yerleşim haritası veya geometri ipucu verilebilir. Yayımlanan kanıt, okuma biçimini ve verilen girdileri belirtmelidir. Ayrıntı için [Sonuçlar ve terimler](RESULTS_AND_TERMS_TR.md#modüllere-göre-kör-okuma) bölümüne bakın.

### Orijinal ve çalışma kopyası

Orijinal dosyayı değiştirmeden saklayın. Ayrı bir **çalışma kopyasını** mühürleyin; iki dosyayı da checksum ve kayıt bilgileriyle koruyun. Böylece mühürleme adımına ne verildiği belli olur ve yanlışlıkla geri dönüşsüz düzenleme yapılmaz. TancMark okuyucuları normalde mühürsüz orijinal verilmeden gelen çalışma kopyasını inceler.

### Sahiplik ne zaman doğrulanır?

Yalnız fiziksel iz yetmez. Modül kapsamındaki kesin sonuç için beklenen tam kimlik, tekil eşleşen kayıt, doğru tenant/hesap bağı ve geçerli kayıt imzası gerekir. Kısa 32-bit locator, kısmi kimlik, benzerlik, DNA, ECC, C2PA veya imzalı harita tek başına sahiplik ya da VAULT açamaz.

## Sonuçlar

- `EXACT`: Tam fiziksel kimlik ve gerekli yetki zinciri eşleşti.
- `PARTIAL`: Yararlı sinyal bulundu ama kesin kimlik kararı oluşmadı.
- `MANUAL_REVIEW`: Kanıt belirsiz veya birden fazla kayıt kaldı.
- `NOT_FOUND`: Gerekli fiziksel kanıt okunamadı.
- `FAIL-CLOSED`: Zorunlu güvenlik koşulu yoksa sistem tahmin yürütmeden durur.

Kapsam önemlidir. Tam ses kimliği ses katmanını doğrular; videonun görüntü katmanını kendiliğinden doğrulamaz. İnceleme sonucunu yorumlamadan önce [Sonuçlar ve terimler](RESULTS_AND_TERMS_TR.md) belgesini okuyun.

## C2PA ile TancMark kimliği arasındaki fark

C2PA içerik geçmişini ve imzalı manifestin dosyayla bağını denetler. TancMark tam doğrulaması fiziksel TancMark kimliğini kayıt, tenant ve imza zincirine karşı denetler. Birlikte kullanılabilirler; ancak C2PA hiçbir zaman TancMark sahipliği veya VAULT açmaz.

## DNA, Chief Brain ve Discovery

DNA modül kanıtlarını ve sağlık bilgilerini düzenler. Chief Brain özetler ve öneri sunar; ürün kararını kendiliğinden değiştirmez. `autoApply=false` varsayılanı korunur. Dış Discovery sonuçları inceleme adayıdır, sahiplik kanıtı değildir. Kesin karar için yine tam modül kanıtı ve normal kayıt/imza zinciri gerekir.

## Kurulum seçenekleri

İki kaynak yolundan birini kullanın:

1. `https://github.com/adem-kursat-tanc/tancmark` adresindeki sahip-yayınlı GitHub deposunu klonlayın.
2. Seçilen commit için GitHub source ZIP'ini indirin, kısa ve boş bir klasöre çıkarın, iç checksumları doğrulayın.

Sahibin yayımladığı ilk GitHub ön sürümü [`v0.1.0-rc.1`](https://github.com/adem-kursat-tanc/tancmark/releases/tag/v0.1.0-rc.1) sürümüdür. Bu sürüme eklenen deterministik kaynak arşivini tercih edin, yanındaki SHA-256 dosyasını doğrulayın ve sürüm etiketini sahibin belirlediği commit ile karşılaştırın. Resmî olmayan adres uydurmayın veya kullanmayın.

### Klonu doğrulama

PowerShell:

```powershell
git clone https://github.com/adem-kursat-tanc/tancmark C:\tm\tancmark
Set-Location C:\tm\tancmark
git rev-parse HEAD
git status --short
```

Bash:

```bash
git clone https://github.com/adem-kursat-tanc/tancmark /tmp/tancmark
cd /tmp/tancmark
git rev-parse HEAD
git status --short
```

### Source ZIP'i doğrulama

ZIP'i `C:\tm\tancmark` gibi kısa ve boş bir yola çıkarın. Eski bir kopyanın üstüne birleştirmeyin.

PowerShell ile tüm dosyaları doğrulama:

```powershell
Set-Location C:\tm\tancmark
$failed = 0
Get-Content .\SHA256SUMS | ForEach-Object {
  if ($_ -notmatch '^([0-9a-f]{64})  (.+)$') { throw "Geçersiz SHA256SUMS satırı: $_" }
  $expected = $Matches[1]
  $file = $Matches[2]
  $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { $failed++; Write-Error "Checksum uyuşmadı: $file" }
}
if ($failed -ne 0) { throw "$failed checksum hatası" }
```

Bash:

```bash
cd /tmp/tancmark
sha256sum -c SHA256SUMS
```

`reports/PUBLIC_SOURCE_MANIFEST.json` aynı takipli kaynak envanterini, byte sayılarını ve hashleri içerir. Son satır sayısı manifestteki `fileCount` ile eşleşmelidir. Checksum, manifest kaydı veya ZIP CRC hatalıysa yalnız o çıkarılmış kopyayı silin ve sahibin yayımladığı kaynaktan yeniden indirin.

## Gereksinimler

Yalnız kullanacağınız modülün gereksinimlerini kurun.

### Temel kaynak ve build

- Node.js 24 veya daha yeni
- Corepack
- Corepack ile seçilen pnpm 10.34.5
- API sunucusu ve veri tabanlı metin/kayıt işlemleri için PostgreSQL

Tam ve makineler arası bir alt sınır ölçülmediği için genel disk veya RAM asgari değeri iddia edilmez.

### Medya modülleri

Dondurulmuş Windows referansı Python 3.14.7, NumPy 2.5.2, PyAV 18.0.0 ve FFmpeg 8.1.2 kullanır. MediaMTX yalnız onu kullanan operatör Live akışında gerekir. Bu binaryler depoya gömülü değildir. Doğrulanmış mutlak yollar kullanın; sistem `PATH` değerine güvenmeyin. [Doğrulanmış medya runtime'ını kurma](BUILD_VERIFIED_MEDIA_RUNTIME.md) belgesini izleyin.

### C2PA

C2PA, sabitlenmiş `@contentauth/c2pa-node` 0.9.1 paketini ve checksum ile doğrulanan native bileşenini kullanır. Normal kurulum sabit resmî arşivi alır. Çevrim dışı operatör, önceden indirilmiş aynı arşivi `TANCMARK_C2PA_NATIVE_ARCHIVE` ile verir. Test ve üretim sertifikalarını ayırın. Yerel ürün yolu ES256 kabul eder, RSA-PSS imzalamayı reddeder.

## Kaynak kurulumu

Depo kökünde:

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm run build:product
pnpm test
pnpm run test:documentation
```

Bu komutlar kamu kaynak sözleşmesinde doğrulanır. `pnpm install --frozen-lockfile`, paketler ve doğrulanmış C2PA native arşivi için ağ erişimi isteyebilir. Çevrim dışı C2PA kurulumu ve veri tabanı için [Operatör Kılavuzu](OPERATOR_GUIDE_TR.md) belgesine bakın.

## Sunucuyu başlatma

Kaynak sunucu `PORT` ve `DATABASE_URL` ister. Üretim modu ayrıca kamuya açık demo anahtarını reddeder: operatörün ürettiği bir `AEGIS_SECRET` ayarlayın (32 veya daha fazla rastgele karakter önerilir; kaynağın zorunlu alt sınırı 8'dir). Önce veri tabanı ile sırları yapılandırın. Ürün paketini oluşturup API workspace'inden başlatın:

PowerShell:

```powershell
$env:PORT = '5000'
$env:DATABASE_URL = 'postgresql://tancmark_app:<PAROLA>@127.0.0.1:5432/tancmark'
$env:ADMIN_TOKEN = '<EN_AZ_16_RASTGELE_KARAKTER>'
$env:AEGIS_SECRET = '<EN_AZ_32_RASTGELE_KARAKTER_ONERILIR>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Bash:

```bash
export PORT=5000
export DATABASE_URL='postgresql://tancmark_app:<PAROLA>@127.0.0.1:5432/tancmark'
export ADMIN_TOKEN='<EN_AZ_16_RASTGELE_KARAKTER>'
export AEGIS_SECRET='<EN_AZ_32_RASTGELE_KARAKTER_ONERILIR>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Gerçek parola veya tokenı Git'e, belgeye, kabuk geçmişine ya da ekran görüntüsüne koymayın. Üretimde operatörün sır yöneticisini kullanın.

### Sağlık kontrolü

```sh
curl http://127.0.0.1:5000/api/healthz
```

Beklenen gövde:

```json
{"status":"ok"}
```

## Medya modüllerini kullanma

### Metin

Belgelenmiş ürün rotası `POST /api/aegis/protect-text` yoludur. Sunucunun doğruladığı API istemcisi veya kayıtta var olan müşteriyi çözen yönetici gerekir. `POST /api/aegis/analyze-text` admin token ister. İstek gövdesindeki kimliği yetki kabul etmeyin. Test edilmiş istekler için [API Örnekleri](API_EXAMPLES_TR.md#metin) belgesini kullanın.

Ürün güvenli varsayılanı kasıtlı olarak kelime değiştirmez veya anlamı bozmaz. Eski değiştirici davranış ayrı kapatılmış laboratuvar modudur; kamu varsayılanı değildir.

### Görsel

Kamu kaynağında test edilmiş görsel taşıyıcı kodu ve admin görsel test alanı vardır. OpenAPI'da ürün düzeyinde görsel mühürle/geri oku HTTP çifti yoktur. Doğrulanmış medya gereksinimlerini kurduktan sonra `pnpm run test:physical-text-image` çalıştırın. Görsel laboratuvarını sahiplik API'si diye sunmayın. Kamu smoke kanıtının sınırı [Görsel dayanıklılığı](robustness/image.md) belgesindedir.

### Ses

Bağımsız ses uygulaması ve karar sözleşmesi bulunur. Ses laboratuvar rotası kamu ürün rotası değildir; ürün paketi `410` döndürür. Doğrulanmış medya runtime'ı ile `pnpm run test:physical-audio` çalıştırın. Tam ses sonucu yalnız ses katmanına aittir. [Ses dayanıklılığı](robustness/audio.md) belgesine bakın.

### Video

Video Primary korumalı Live ürün yolu ve yayımlanmış doğrulama programları üzerinden kullanılır. Doğrudan video lab encode/decode ve doğrudan kanonik okuyucu kamu ürün endpoint'i değildir; ürün paketi `410` döndürür. Kanonik okuyucu yalnız doğrulanmış Live oturumu içinde çağrılır. [Video dayanıklılığı](robustness/video.md) ile [Live ürün kılavuzuna](TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md) bakın.

## Live

Yerel korumalı Live `/api/tancmark/live/local/v1` altında çalışır. Tam kimliği ve kayıt bağını sunucu üretir. Normal akış: oturum oluştur, geçerli H.264/AAC CMAF init parçasını yükle, başlat, sıralı CMAF parçalarını ekle, durdur ve tamamlanmış tam doğrulamayı oku.

Yönetim istekleri `x-admin-token` ve doğrulanmış tenant ister. Düz HTTP yalnız aynı bilgisayarda kabul edilir; uzaktan kullanım gerçek TLS bağlantısı ister. Dış yayın sağlayıcıları operatör tarafından yapılandırılır ve varsayılan ürün onlara bağlanmaz.

[Live API örnekleri](API_EXAMPLES_TR.md#yerel-korumalı-live), [Live kılavuzu](TANCMARK_LIVE_INSTREAM_PRODUCT_GUIDE_20260828.md) ve [dış sağlayıcı kontrol listesi](LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md) kullanılmalıdır.

## C2PA

Girdinin çalışma kopyasını yapılandırılan tenant köküne koyun. Yalnız `assetName` ile `POST /api/tancmark/c2pa/v1/inspect` veya `/verify` kullanın. İmzalama yeni `outputName`, açık `intent` ve belgelenmiş kamu kayıt alanlarını ister. `CREATE` geçerli `digitalSourceType` ister; `EDIT` ve `UPDATE` bu alanı yasaklar.

Sunucu gövdede ham anahtar, sertifika, tenant kimliği, tam kimlik, kayıt satırı, dosya yolu, harita, trust anchor, TSA URL'si veya uzak manifest URL'si kabul etmez. [C2PA API örnekleri](API_EXAMPLES_TR.md#c2pa) ve [C2PA Kılavuzu](C2PA_GUIDE.md) kullanılmalıdır.

## Evidence ve Secure Room

Kanıtı kişisel bilgilerden arındırın ve erişimini sınırlayın. Checksum, modül/okuma biçimi, verilen girdiler, kayıt/imza sonucu, zaman ve destek kanıtı ile tam karar ayrımını koruyun. Özel anahtar, token, ham tam kimlik, kayıt satırı, özel harita, müşteri verisi, yerel yol veya özel medya parmak izi dışa aktarılmamalıdır.

Secure Room kodu vardır; ancak rotaları güncel OpenAPI kamu sözleşmesinde değildir. Bu nedenle bu kılavuz onları desteklenen kamu API'si olarak sunmaz. API sözleşmesi uzlaştırılana kadar operatörün incelenmiş iç iş akışı kullanılmalıdır.

## Sonuçları okuma ve güvenli saklama

Modül, sonuç sınıfı, okuma biçimi, verilen beklenen kimlik/aday bilgisi, kayıt sonucu, tenant sonucu, imza sonucu ve kaydın tekil olup olmadığını kaydedin. Orijinal, çalışma kopyası, gelen kopya ve kanıt çıktısını ayrı tutun. Kayıt yedekleri ile anahtarlarda şifreleme ve en az yetki kullanın.

Sonuç `PARTIAL`, `MANUAL_REVIEW` veya `NOT_FOUND` ise sahiplik diye yeniden adlandırmayın. Aynı locator kovasında birden fazla kayıt varsa hiçbir kayıt otomatik seçilmez.

## Sık yapılan hatalar

- API'yi `PORT`, `DATABASE_URL` veya üretimde demo olmayan bir `AEGIS_SECRET` olmadan başlatmak.
- Farklı pnpm sürümü ya da frozen olmayan kurulum kullanmak.
- Yeni source ZIP'i eski klasörün üstüne birleştirmek.
- Gövdedeki tenant veya kimliği yetki sanmak.
- `dist-product` içinde video/ses lab rotasını çağırıp `410` sonucunu motor arızası saymak.
- Medya araçlarının doğrulanmış mutlak yolları yerine sistem `PATH` değerine güvenmek.
- Orijinal veya C2PA girdisinin üstüne yazmak.
- Locator, harita, DNA, Discovery veya C2PA sonucunu sahiplik saymak.
- Uzak bir Live/C2PA rotasını düz HTTP ile çağırmak.

Belirti ve çözüm denetimleri için [Sorun Giderme](TROUBLESHOOTING_TR.md) belgesine bakın.

## Bilinen sınırlar

- Deponun gerçek sentetik-fixture demosu yalnız operatör denetimli deneysel yerel/Docker demo olarak kullanılabilir; GitHub üzerinde barındırılan Codespaces başlatması şu anda kullanılamaz ve ürün yayın kapısı değildir.
- Masaüstü, mobil, tarayıcı veya WebAssembly ürünü yoktur.
- Linux ilk gönderim CI doğrulamasını bekler; macOS test edilmedi.
- Dondurulmuş ileri Video matrisinin iki hücresi güvenli biçimde başarısızdır.
- Dış sağlayıcı teslimi ve üretim kurulumu operatör işidir.
- Kamu görsel/ses dayanıklılık iddiaları tarihsel özel araştırma kümesinden daha dardır.
- PDF/WAV C2PA ürün desteği ölçülmedi.
- Teknik sonuçlar kendiliğinden hukuki karar değildir.

## Güvenlik bildirimi

[SECURITY.md](../SECURITY.md) sürecini kullanın. Güvenlik açığı, sır, müşteri dosyası, arındırılmamış kanıt, özel tam kimlik, kayıt içeriği veya yerel yol içeren herkese açık issue açmayın.

## Lisans ve katkı

TancMark `AGPL-3.0-only` ile lisanslanır. Katkılar [CLA.md](../CLA.md) kabulünü gerektirir. Pull request yalnız proje sahibinin veya onun açıkça yetkilendirdiği maintainer'ın onayıyla birleştirilebilir.

Bütün belgeler için [Dokümantasyon Dizini](DOCUMENTATION_INDEX.md) bölümüne bakın.
