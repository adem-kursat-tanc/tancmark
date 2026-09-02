# TancMark Sorun Giderme

İlk başarısız kapıdan başlayın. Komut, çıkış kodu, kamu hata kodu ve sırlardan arındırılmış logu koruyun. Hatayı yok etmek için mühür eşiği, kimlik kuralı, fixture, tenant kuralı veya imza şartını değiştirmeyin.

## Kaynak ve checksum

### `SHA256SUMS` uyuşmuyor

ZIP bozuk, dosya çıkarıldıktan sonra değişmiş veya farklı commitlerin dosyaları karışmış olabilir. Kurulumu durdurun; boş klasöre çıkardığınızı, duyurulan ZIP SHA-256 ve commit kimliğini doğrulayın. Yalnız başarısız çıkarılmış kopyayı silip sahibin kaynağından yeniden indirin. Başka checkout'tan dosya kopyalayarak “tamir” etmeyin.

### Yeni Git klonu daha kurulmadan kirli

`git status --short` çalıştırın. Klasörde kendi işiniz olma ihtimali varsa reset atmayın. Yeni kısa ve boş klasöre tekrar klonlayın.

### Kanonik depo adresi eksik

Sahip tarafından doğrulanan `https://github.com/adem-kursat-tanc/tancmark` adresini iki dildeki kılavuzlarda kullanıp `pnpm run test:documentation` çalıştırın.

## Node, Corepack ve pnpm

### Node eski

`node --version` çalıştırın. Node.js 24 veya daha yeni gerekir. Desteklenen sürümü depo dışına kurup kabuğu yeniden açın.

### pnpm sürümü yanlış

```sh
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm --version
```

Sonuç `10.34.5` olmalıdır. Başka sürümle lockfile üretmeyin.

### Frozen kurulum başarısız

İlk hatayı okuyun. Ağ yokluğu, değişmiş lockfile, paket kaynağı, disk, antivirüs kilidi veya C2PA native doğrulaması sebep olabilir. Çözüm diye `--no-frozen-lockfile` kullanmayın. Çevrim dışı C2PA için yalnız rapordaki tam arşiv/checksum ile mutlak `TANCMARK_C2PA_NATIVE_ARCHIVE` yolunu kullanın.

### Windows yolu çok uzun

`C:\tm\tancmark` gibi kısa ve boş yol kullanın. V8 denetiminde uzun yolda kurulum hatası görüldü; aynı exact arşiv kısa yolda geçince kabul edildi. Kaynak dosyayı değiştirmeyin.

## Build ve testler

### Typecheck/build hatası

Node 24+, pnpm 10.34.5, temiz kaynak ve frozen kurulumu doğrulayın. Önce `pnpm run typecheck`, sonra iki build'i çalıştırın. İlk derleyici hatasını koruyun.

### Temel test geçiyor ama medya çalışmıyor

Temel testler dış medya runtime'ını kurmaz ve her özel gerçek medya kapısını geçmiş saymaz. Mutlak Python/FFmpeg yollarını ayarlayıp ilgili medya, Live veya C2PA testini çalıştırın.

### Tedarik zinciri testi ağ yok diyor

Bu test güncel dış advisory ve upstream kimliğini denetler. Ağ yok sonucu başarı değildir. Onaylı bağlı ortamda sonra tekrar çalıştırın.

## PostgreSQL ve sunucu

### `DATABASE_URL must be set`

Geçerli PostgreSQL bağlantısını süreç sır sınırında ayarlayın. API veri tabanı paketini başlangıçta import eder. Gerçek bağlantıyı Git'e koymayın.

### Bağlantı reddediliyor

PostgreSQL hizmeti, host/port/veri tabanı, uygulama rolü, TLS ve firewall'u kontrol edin. Aynı bağlantıyı PostgreSQL aracıyla TancMark dışında deneyin.

### Tablo/sütun yok

Yedek alın, şemayı inceleyin ve `pnpm --filter @workspace/db run push` çalıştırın. `push-force` ile kestirme yapmayın.

### `PORT environment variable is required`

Başlatmadan önce pozitif sayısal `PORT` ayarlayın. Port doluysa sahibi bilinen hizmeti yönetin veya onaylı boş port seçin; bilinmeyen süreci öldürmeyin.

### Sağlık rotası 404

URL'de `/api` bulunduğunu doğrulayın: `http://127.0.0.1:<PORT>/api/healthz`.

## Kimlik doğrulama ve tenant

### `admin_token_unconfigured` (`503`)

En az 16 rastgele karakterli `ADMIN_TOKEN` ayarlayıp süreci yeniden başlatın. Placeholder kullanmayın.

### `invalid_api_key` / `api_key_security_not_configured`

Anahtarın güncel veri tabanından verildiğini ve plaintextin doğru olduğunu kontrol edin. `TANCMARK_API_KEY_PEPPER`/`AEGIS_API_KEY_PEPPER`, anahtar üretilirken kullanılan değerle aynı olmalıdır. Ürün modu eksik/kısa pepper'ı reddeder.

### `seal_identity_spoofing_rejected` / `seal_identity_mismatch`

Gövde/query/header içindeki tenant yetkisini çıkarın. Doğrulanmış API istemcisi yalnız kendisi adına mühürler. Yönetici kayıtta var olan müşteriyi çözmelidir; rastgele ID yazarak yetki oluşturamaz.

### Yanlış tenant `404` dönüyor

Bu kasıtlı gizleme davranışıdır. API istemcisini veya yapılandırılmış başlıkla tam eşleşmeyi kontrol edin. Başka tenant kaydının varlığını göstermek için rotayı değiştirmeyin.

## Ürün rotaları

### Video/ses lab HTTP `410`

`dist-product` içinde bu beklenir. Laboratuvar rotası bilerek kapalıdır. Lab çalışması için yayımlanan doğrulama programlarını kullanın. Kanonik video okuyucu yalnız doğrulanmış sunucu içi Live akışına açıktır.

### Kod rotası OpenAPI'da yok

Bunu `PUBLIC_API_DOCUMENTATION_MISMATCH` sayın; gizli kamu özelliği saymayın. Ayrı sahip incelemesiyle route/API sözleşmesi uzlaştırılmadan dışa açmayın.

## Medya runtime'ı

### FFmpeg/FFprobe/Python/PyAV/NumPy reddediliyor

`pnpm run test:media-runtime` çalıştırın. Her yol mutlak, depo dışında, normal linksiz dosya olmalı ve dondurulmuş sürüm/checksumla eşleşmelidir. Ürün modu `PATH` içindeki ada güvenmez.

### GPL/nonfree/libx264/libx265 reddi

Doğrulanmış ürün FFmpeg profili LGPL uyumlu, shared, ağsız ve bu kütüphaneler olmadan yapılmıştır. Doğrulanmış rehberden yeniden derleyin; resolver'ı gevşetmeyin.

### Görsel/ses fiziksel testi atlandı veya geçmedi

Mutlak runtime yollarını ve ilgili dayanıklılık belgesini kontrol edin. Kamu aritmetik/karar smoke'u codec saldırı matrisi değildir. Ölçülmeyeni `NOT_MEASURED` yazın.

## Live

### `live_local_transport_boundary_rejected` (`403`)

Düz HTTP loopback dışı soketten geldi. Aynı makinede `127.0.0.1` kullanın veya gerçek TLS kurun. Forwarded header soket kararını değiştiremez.

### Korumalı oturum hazır değil

Doğru yetkiyle status rotasını çağırın. Saklama, keyring, tenant, worker, Python, FFmpeg/FFprobe ve kimlik entegrasyonunu çözün.

### Init/parça reddediliyor

Gerçek destekli CMAF parçası, `application/octet-stream`, tam `x-content-sha256`, sıra/süre/idempotency başlıkları gerekir. Çözülen track ve süre yetkilidir.

### `409` revision/idempotency

Güncel oturumu okuyup son `revision` değerini kullanın. Idempotency key'i yalnız aynı istek için tekrar kullanın.

### `507` saklama

Kota veya boş alan rezervi geçmedi. Ingest'i durdurun, oturum/journal'ı koruyun; alan ekleyin veya incelenmiş saklama akışını uygulayın. Geniş klasörü elle silmeyin.

### Worker/nihai doğrulama hatası

Ürün güvenli biçimde durur ve mühürsüz fallback yayımlayamaz. Arındırılmış durum ile journal'ı koruyun; runtime hash, kuyruk, worker çıkışı, korumalı çıktı, final kayıt ve kayıt/imza bağını inceleyin. Eşik düşürmeyin.

### Dış sağlayıcı SKIPPED

Operatör hesap/şart/sır yapılandırması ve kontrol listesini tamamlayana kadar normaldir. Yerel korumalı Live, hazır dış sağlayıcı olmadan tamamlanmış olabilir.

## C2PA

### `c2pa_*` hatası

Tam kamu hata kodunu okuyun. Asset adı tenant kökü içindeki basit addır; yol değildir. Çıktı yeni olmalıdır. Gövdede ham anahtar, sertifika, tenant/client, tam ID, kayıt, harita, trust anchor, TSA ve uzak URL yasaktır.

### `UNSUPPORTED_FORMAT`

Güncel ürün yalnız yerelde test edilen PNG, JPEG, MP4 ve MOV'u kabul eder. PDF/WAV `NOT_MEASURED` durumundadır; yeniden adlandırıp politikayı aşmayın.

### `VALID_BUT_UNTRUSTED`

Manifest kriptografik olarak geçerli olabilir ama sertifika kamu güven listesinde olmayabilir. Yerel test sertifikasında bu normaldir. Sahiplik veya resmî güven değildir.

### `ASSET_TAMPERED` / `INVALID_SIGNATURE`

Dosyayı kanıt olarak koruyun. Yeniden imzalayıp eski imzayı geçerli göstermeyin. Checksum ve provenance zincirini inceleyin.

### Uzak manifest engelli

Uzak manifest alma bilerek uygulanmamıştır ve `C2PA_REMOTE_MANIFEST_FETCH=false` kalır. Gömülü manifest kullanın.

### Anahtar okunmadan imza reddi

Ürün yerel RSA-PSS'i kapatır. ES256 veya ayrıca incelenmiş KMS/HSM/subprocess signer kullanın. Anahtar yolları depo dışında ve yalnız servis hesabına açık olmalıdır.

## Sonuç ve kanıt

### Locator eşleşti ama sahiplik false

Doğru davranıştır. Locator yalnız aday kovasını bulur. Tam fiziksel kimlik, tekil kayıt, tenant/hesap ve imza yine gerekir.

### Birden fazla aday var

`MANUAL_REVIEW` döndürün; en yüksek skor veya ilk kaydı otomatik seçmeyin.

### C2PA/DNA/Discovery pozitif ama VAULT false

Doğrudur. Bunlar provenance, danışman veya keşif destek katmanıdır. [Sonuçlar ve terimler](RESULTS_AND_TERMS_TR.md) belgesine bakın.

## Güvenli kapatma ve kalıntı

`SIGINT` veya `SIGTERM` kullanıp kapanmayı bekleyin. Ürün sunucusu, watermark worker, C2PA geçici dosyası ve Live journal'larını kontrol edin. Yalnız exact doğrulanmış temp/oturum yolunu temizleyin. Disk kökü, profil, depo veya çözülmemiş reparse hedefinde recursive silme yapmayın.

Sorun güvenlik açığı veya sır sızıntısı olabilir diyorsanız herkese açık issue yerine [SECURITY.md](../SECURITY.md) sürecini kullanın.
