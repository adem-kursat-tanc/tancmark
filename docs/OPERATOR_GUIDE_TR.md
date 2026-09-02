# TancMark Operatör Kılavuzu

Bu kılavuz kaynak doğrulama, kurulum, yerel ürün başlatma, sırlar, PostgreSQL, medya ve C2PA runtime'ları, test, yedekleme ve güvenli kapatmayı kapsar. Laboratuvar rotalarını kamu ürün API'sine dönüştürmez ve dış yayın sağlayıcılarını sizin yerinize yapılandırmaz.

## Kurulum sınırı

Kamu deposu kendi sunucunuzda çalıştırılan Node.js/TypeScript referans uygulamasıdır. Paketlenmiş masaüstü, mobil veya tarayıcı uygulaması değildir. Test edilmiş yerel ürün tek düğümlüdür. Üretim TLS'i, reverse proxy, ortak durum, worker yapısı, izleme, saklama ve felaket kurtarma operatör kararıdır.

İlk kurulumu izole bir makine veya geliştirme hesabında yapın. Kurulum testinde müşteri medyası, üretim anahtarı veya üretim veri tabanı kullanmayın.

## Kurulumdan önce kaynağı doğrulama

`https://github.com/adem-kursat-tanc/tancmark` deposunu kısa ve boş bir yola klonlayın veya GitHub source ZIP'ini böyle bir yola çıkarın.

Klon için şunları kaydedin:

```sh
git rev-parse HEAD
git status --short
git remote -v
```

Source ZIP için bütün takipli dosyaları doğrulayın. Bash:

```bash
sha256sum -c SHA256SUMS
```

PowerShell:

```powershell
$failed = 0
Get-Content .\SHA256SUMS | ForEach-Object {
  if ($_ -notmatch '^([0-9a-f]{64})  (.+)$') { throw "Geçersiz SHA256SUMS satırı: $_" }
  $expected = $Matches[1]; $file = $Matches[2]
  $actual = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { $failed++; Write-Error "Checksum uyuşmadı: $file" }
}
if ($failed -ne 0) { throw "$failed checksum hatası" }
```

Doğrulanan kayıt sayısı `reports/PUBLIC_SOURCE_MANIFEST.json` içindeki `fileCount` ile aynı olmalıdır. Checksum, manifest, ZIP CRC veya duyurulan commit farklıysa durun. Başka bir çalışma ağacından dosya kopyalayarak arşivi tamir etmeyin.

## İşleve göre gereksinimler

### Temel build ve API

- Node.js 24 veya daha yeni
- Corepack ve pnpm 10.34.5
- API başlangıcı ile veri tabanlı kayıt/metin/audit işleri için PostgreSQL

Makineler arasında tamamlanmış asgari ölçüm olmadığı için genel RAM veya disk alt sınırı yayımlanmamıştır. Paket önbelleği, PostgreSQL verisi, Live saklama, medya boyutu, saklama politikası ve build çıktısını kendi makinenizde ölçün.

### Medya ve Live

Dondurulmuş Windows referansı Python 3.14.7, NumPy 2.5.2, PyAV 18.0.0 ve lisans-temiz FFmpeg 8.1.2 yapısını kullanır. MediaMTX yalnız onu kullanan operatör akışında gerekir. Binaryler deponun dışındadır. [Doğrulanmış medya runtime'ını kurma](BUILD_VERIFIED_MEDIA_RUNTIME.md) belgesini izleyin ve mutlak yollar verin. Ürün kodu doğrulanmamış `PATH` karşılığını reddeder.

### C2PA

Kaynak `@contentauth/c2pa-node` 0.9.1 sürümünü sabitler. Kök postinstall sabit resmî native arşivi ve iç binaryyi kurmadan önce doğrular. Uzak manifestler kapalıdır. Yerel ürün imzalaması ES256 kullanır; RSA-PSS ürün modunda reddedilir.

## Kaynağı kurma

Doğrulanmış depo kökünde:

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
```

Başka paket yöneticisi sürümü kullanmayın. Kurulum npm paketleri ve sabit C2PA native arşivi için ağ erişimi isteyebilir.

Doğrulanmış C2PA native installer ile çevrim dışı kurulum için bağlı hazırlık makinesinde tam resmî arşivi indirin ve `reports/C2PA_NATIVE_RELEASE_ASSET_CHECKSUMS.json` ile doğrulayın. Yalnız doğrulanmış arşivi hedefe taşıyın. `pnpm install --frozen-lockfile` öncesinde mutlak yolu ayarlayın.

PowerShell:

```powershell
$env:TANCMARK_C2PA_NATIVE_ARCHIVE = 'D:\verified-input\c2pa-node-archive.zip'
pnpm install --frozen-lockfile
```

Bash:

```bash
export TANCMARK_C2PA_NATIVE_ARCHIVE='/opt/verified-input/c2pa-node-archive.zip'
pnpm install --frozen-lockfile
```

Kurucu alternatif URL veya checksum kabul etmez.

## PostgreSQL yapılandırması

PostgreSQL yönetim sürecinizle ayrı veri tabanı ve en az yetkili uygulama rolü oluşturun. Uygulama hesabı olarak PostgreSQL superuser kullanmayın. Veri tabanı aynı güvenilir makinede değilse TLS kullanın.

Bağlantıyı yalnız süreç sır sınırında tanımlayıp şemayı uygulayın:

PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://tancmark_app:<PAROLA>@127.0.0.1:5432/tancmark'
pnpm --filter @workspace/db run push
```

Bash:

```bash
export DATABASE_URL='postgresql://tancmark_app:<PAROLA>@127.0.0.1:5432/tancmark'
pnpm --filter @workspace/db run push
```

`push` güncel Drizzle şemasını uygular. Var olan veri tabanında önce değişikliği inceleyip yedek alın. `push-force` komutunu sıradan kurulum komutu olarak kullanmayın.

Geliştirme müşterisi ve API anahtarı için ekli script bir kayıt müşterisi ile HMAC-pepper'lı bir anahtar yazar:

```sh
pnpm --filter @workspace/scripts run seed-client -- demo "Demo Client" default
```

Yazdırılan düz anahtarı o anda güvenle saklayın; veri tabanı düz anahtarı saklamaz. Ürün modunda `TANCMARK_API_KEY_PEPPER` veya geriye uyumlu `AEGIS_API_KEY_PEPPER` ile en az 16 karakterlik operatör üretimi pepper ayarlayın. Planlı migration olmadan pepper değiştirmek mevcut API anahtarlarını geçersiz kılar.

## Çekirdek sırlar

Sır yöneticisi veya denk korumalı süreç sınırı kullanın. Değerleri `.env`, kabuk scripti, ekran görüntüsü, ticket veya log içine koymayın.

- `PORT`: API dinleme portu; sunucu girişinde zorunlu.
- `DATABASE_URL`: PostgreSQL bağlantısı; veri tabanı importlarında zorunlu.
- `ADMIN_TOKEN`: en az 16 rastgele karakter.
- `AEGIS_SECRET`: TancMark çekirdek sırrıdır. Ortam değişkeni adı uyumluluk için eski `AEGIS_` önekini korur. Üretim modu demo varsayılanıyla başlamayı reddeder. Kaynağın alt sınırı 8 karakterdir; operatör sır yöneticisinde en az 32 rastgele karakter kullanın. Rotasyonda `AEGIS_SECRET_V1`, `AEGIS_SECRET_V2` ve `ACTIVE_AEGIS_SECRET_VERSION` biçimini tercih edin; kayıtlar hâlâ bağlıyken eski sürümü kaldırmayın.
- `TANCMARK_API_KEY_PEPPER` veya `AEGIS_API_KEY_PEPPER`: ürün API anahtarı HMAC pepper'ı.
- `AEGIS_ALLOWED_ORIGINS`: gerekirse virgülle ayrılmış tarayıcı origin listesi.

Live ve C2PA değişken envanteri için `.env.example` kullanın. Ancak süreç için zorunlu `PORT`, `DATABASE_URL`, `AEGIS_SECRET` (veya sürümlü biçimi) ve API-key pepper şu anda bu örnek dosyada listelenmez; operatörün eklemesi gerekir.

## Yerel korumalı Live yapılandırması

En az ayrı mutlak saklama klasörü, rastgele playback keyring, doğrulanmış yerel tenant ve doğrulanmış medya yolları kullanın:

```text
TANCMARK_LIVE_STORAGE_ROOT=<ayrı-mutlak-saklama-klasörü>
TANCMARK_LIVE_PLAYBACK_KEYRING={"activeKid":"current","keys":{"current":"base64:<en-az-32-rastgele-byte>"}}
TANCMARK_LIVE_LOCAL_TENANT_ID=<doğrulanmış-yerel-tenant>
TANCMARK_LIVE_LOCAL_ACCOUNT_ID=<doğrulanmış-yerel-hesap>
TANCMARK_LIVE_WATERMARK_PYTHON=<mutlak-doğrulanmış-python>
TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT=<repo>/runtime/live/live_streaming_adapter_worker.py
TANCMARK_LIVE_ADAPTER_C_SCRIPT=<repo>/runtime/product-runtime/unified_pts_watermark_adapter_c.py
TANCMARK_FFMPEG_PATH=<mutlak-doğrulanmış-ffmpeg>
TANCMARK_FFPROBE_PATH=<mutlak-doğrulanmış-ffprobe>
```

Saklama klasörü disk kökü, profil kökü, depo, symlink veya junction olmamalıdır. Özel ingest, korumalı parçalar, durmuş kayıt, journal ve saklama için yeterli boş alan bırakın. İsteğe bağlı korumacı sınırlar `.env.example` içindedir.

Normal yol `PROTECTED_TANCMARK` modudur. `TRANSPORT_ONLY` mühürlemeyi kapatır ve sahiplik vermez. Kimlik yetkisi sunucudadır; çağıran ham beklenen kimlik, kayıt satırı, özel harita veya imza göndermez.

Dış sağlayıcılar `config/live-external-providers.schema.json` ve sır deposunun opak referansıyla yerel çekirdeğin dışında yapılandırılır. [Dış sağlayıcı kontrol listesini](LIVE_EXTERNAL_PROVIDER_OPERATOR_CHECKLIST.md) kullanın. Varsayılan testler hiçbir sağlayıcıya bağlanmaz.

## C2PA yapılandırması

Her tenant için ayrı, linksiz çalışma kopyası kökü ayarlayın:

```text
C2PA_REMOTE_MANIFEST_FETCH=false
TANCMARK_C2PA_TENANT_ROOTS_JSON={"verified-tenant-id":"<mutlak-ayrı-çalışma-kopyası-klasörü>"}
TANCMARK_C2PA_REGISTRY_REFERENCE_HMAC_KEYS_JSON={"verified-tenant-id":"<en-az-32-byte-base64url-sır>"}
TANCMARK_C2PA_SIGNING_ENABLED=0
```

İmzalamayı yalnız depo dışındaki ES256 sertifika ve özel anahtar verildikten sonra açın:

```text
TANCMARK_C2PA_SIGNING_ENABLED=1
TANCMARK_C2PA_SIGNING_PROFILES_JSON={"verified-tenant-id":{"certificatePath":"<mutlak-sertifika-yolu>","privateKeyPath":"<mutlak-özel-anahtar-yolu>","algorithm":"es256"}}
```

Test sertifikası üretim güveni değildir. Üretim sertifika döngüsü, KMS/HSM, iptal, TSA, kamu Trust List katılımı ve C2PA uygunluk süreci operatör işidir. [C2PA Kılavuzuna](C2PA_GUIDE.md) bakın.

## Build ve doğrulama

Depo kökünde kamu kapılarını çalıştırın:

```sh
pnpm run typecheck
pnpm run build
pnpm run build:product
pnpm test
pnpm run test:documentation
pnpm run test:toolchain-supply-chain
pnpm run sbom
```

`test:toolchain-supply-chain` güncel advisory ve upstream denetimi için ağ ister. Ağ yok sonucu başarı değildir.

Doğrulanmış medya runtime'ını yapılandırdıktan sonra yalnız ilgili kapıları çalıştırın:

```sh
pnpm run test:media-runtime
pnpm run test:physical-text-image
pnpm run test:physical-audio
pnpm run test:clean-live
pnpm run test:c2pa
```

Özel gerçek medya sözleşmeleri operatör manifesti isteyebilir ve temel build tarafından geçmiş sayılmaz. Başarı için eşik düşürmeyin veya fixture değiştirmeyin.

## Ürün paketini başlatma

PowerShell:

```powershell
$env:NODE_ENV = 'production'
$env:PORT = '5000'
$env:DATABASE_URL = 'postgresql://tancmark_app:<PAROLA>@127.0.0.1:5432/tancmark'
$env:ADMIN_TOKEN = '<EN_AZ_16_RASTGELE_KARAKTER>'
$env:AEGIS_SECRET = '<EN_AZ_32_RASTGELE_KARAKTER_ONERILIR>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Bash:

```bash
export NODE_ENV=production
export PORT=5000
export DATABASE_URL='postgresql://tancmark_app:<PAROLA>@127.0.0.1:5432/tancmark'
export ADMIN_TOKEN='<EN_AZ_16_RASTGELE_KARAKTER>'
export AEGIS_SECRET='<EN_AZ_32_RASTGELE_KARAKTER_ONERILIR>'
pnpm run build:product
pnpm --filter @workspace/api-server run start:product
```

Sağlık kontrolü:

```sh
curl --fail http://127.0.0.1:5000/api/healthz
```

Beklenen JSON `{"status":"ok"}` değeridir. API tabanı `/api` yoludur. [API Örneklerini](API_EXAMPLES_TR.md) yalnız ilgili doğrulanmış müşteri, tenant, saklama ve anahtar yapılandırması tamamlanınca kullanın.

Düz HTTP'yi uzaktan açmayın. Live ve C2PA, düz HTTP'yi yalnız gerçek loopback soketinde kabul eder; sahte forwarded header bu kararı değiştirmez.

## Ürün ve laboratuvar rotaları

Ürün build'i ses/video lab router'larını özellikle HTTP `410` döndüren karşılıklarla değiştirir ve doğrudan kanonik video okuyucuyu kapatır. Bu beklenen davranıştır. Kanonik okuyucu `dist-product` içinde yalnız sunucunun doğrulanmış iç Live zinciri için bulunur.

OpenAPI eski görsel ve video laboratuvar sözleşmelerini sözleşme geçmişi için içerir. Bu onları üretim sahiplik API'si yapmaz. Ses laboratuvarı ve bazı destek rotaları kodda olup OpenAPI'da yoktur. Bunlar `PUBLIC_API_DOCUMENTATION_MISMATCH` olarak kaydedilir ve bu kılavuzlarda kamu API'si diye sunulmaz.

## İşletim ve izleme

- Süreç sağlığı, PostgreSQL, Live boş alanı, depolama sınırları, worker kuyruğu, başarısız oturum, nihai doğrulama ve cleanup journal'larını izleyin.
- `PARTIAL`, `MANUAL_REVIEW` ve `NOT_FOUND` sonuçlarını sahiplik saymayın.
- İstek sırrı, ham tam kimlik, kayıt satırı, özel harita, sertifika, anahtar, yerel yol ve müşteri içeriğini loglamayın.
- Belgelenmiş LOW log-serializer borcunu kurulum incelemesinde tutun; hassas üretim verisinden önce son log hedefini doğrulayın.
- Sunucu, veri tabanı, medya runtime'ı ve saati operatör bakımıyla güncel tutun.
- Tenant varlığını açıklamadan admin ve API-key hatalarını sınırlandırıp izleyin.

## Yedekleme ve geri yükleme

Şunları ayrı sınıflarda yedekleyin:

- PostgreSQL kayıt, imza, audit metadata ve şema sürümü.
- Ayrı Live kökündeki oturum metadata, kanıt, journal ve korumalı medya.
- Saklama politikasının gerektirdiği C2PA çalışma kopyaları.
- Yapılandırma referansları ve anahtar kimlikleri.
- Anahtar ve sırlar yalnız sır yöneticisinin yedek yöntemiyle; kaynak veya sıradan veri yedeğinde değil.

Yedekleri şifreleyin, geri yükleme yetkisini sınırlayın ve izole makinede deneyin. Veri tabanı snapshot'ı, korumalı dosyalar, imzalar ve anahtar sürümleri arasındaki bağı koruyun. Eşleşen anahtar sürümü olmayan kayıt geçerli doğrulama zinciri oluşturamaz.

## Kapatma, temizlik ve saklama

`SIGINT` veya `SIGTERM` gönderip sunucunun kapanmasını bekleyin. Medya worker'ı ya da geçici C2PA dosyası kalmadığını doğrulayın. Hata kurtarma testi dışında imzalama veya Live finalize sırasında süreci zorla öldürmeyin.

Live cleanup iki adımlıdır: yalnız yönetilen medya için plan oluşturun; dosya/byte sayısı ve onay özetini inceleyin; ardından aynı revision, idempotency key ve `If-Match` özetiyle uygulayın. Metadata, kanıt ve audit tutulur. Legal hold yıkıcı temizliği engeller.

Saklama kökü, profil, depo veya çözülmemiş link hedefinde recursive silme yapmayın. Saklama politikasını kesin tenant/oturum hedeflerine uygulayın ve incelenmiş geri yükleme yolunu koruyun.

## Güvenlik ve yayın kontrol listesi

Üretim kurulumu veya sahibin onayladığı GitHub yayını öncesinde:

1. Typecheck, iki build, kamu testleri, belge testleri, ilgili gerçek medya kapıları, Live exact, C2PA negatifleri, SBOM/lisans, gizlilik/sır/yol/medya taraması ve arşiv checksumlarını çalıştırın.
2. Wrong ID, no ID, wrong tenant, mühürsüz medya, belirsiz locator ve yetkisiz mühürlemede sahipliğin 0 olduğunu doğrulayın.
3. `dist-product` içinde kamu video/ses lab ve doğrudan okuyucu rotalarının `410` döndürdüğünü doğrulayın.
4. Bütün üretim sırlarının operatör sınırından geldiğini ve log/kanıttan çıkarıldığını doğrulayın.
5. Gerçek TLS, yedek, izleme, anahtar döndürme, saklama, rate limit ve olay müdahalesini kurun.
6. Depo adresinin `https://github.com/adem-kursat-tanc/tancmark` olarak kaldığını doğrulayıp `pnpm run test:documentation` çalıştırın.

Güncel V13 envanteri 1.188 bağımlılığı kapsar: 677 JavaScript paketi ve 511 native Rust paketi. Çözümsüz lisans sayısı 0'dır. Bu hukuki onay iddiası değildir.

Güvenli kurulum ayrıntıları için [Güvenlik ve Kurulum Kılavuzunu](SECURITY_DEPLOYMENT_GUIDE.md), bütün belgeler için [Dokümantasyon Dizinini](DOCUMENTATION_INDEX.md) kullanın.
