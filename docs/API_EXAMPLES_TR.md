# TancMark API Örnekleri

Bu örnekler `lib/api-spec/openapi.yaml` ile bağlı Express middleware koduna dayanır. Köşeli placeholder değerlerini kendi ortamınızda değiştirin. Gerçek token, parola, özel kimlik, anahtar, kayıt satırı veya yerel yolu kaynak kontrolüne koymayın.

Varsayılan taban `http://127.0.0.1:5000/api` yoludur. Düz HTTP yalnız aynı bilgisayarda kullanılmalıdır. Uzaktaki Live veya C2PA erişimi gerçek TLS soketi ister.

PowerShell:

```powershell
$base = 'http://127.0.0.1:5000/api'
$admin = '<ADMIN_TOKEN>'
$tenant = '<TENANT_ID>'
```

Bash:

```bash
base='http://127.0.0.1:5000/api'
admin='<ADMIN_TOKEN>'
tenant='<TENANT_ID>'
```

## Sağlık

```sh
curl --fail http://127.0.0.1:5000/api/healthz
```

Beklenen yanıt:

```json
{"status":"ok"}
```

## Metin

### Ürün güvenli çalışma kopyasını mühürleme

Kaynak rota doğrulanmış mühürleme principal'ı ister. Sunucunun verdiği geçerli `x-api-key` kullanın. Alternatif olarak admin token ile kayıtta var olan müşteri `clientId`/`TANCMARK_ADMIN_DEFAULT_CLIENT_ID` üzerinden çözülmelidir. Gövdedeki tenant her zaman reddedilir.

PowerShell:

```powershell
$headers = @{ 'x-api-key' = '<API_KEY>' }
$body = @{ text = 'Korunacak örnek belge.'; aiTrapMode = 'off' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/aegis/protect-text" -Headers $headers -ContentType 'application/json' -Body $body
```

Bash:

```bash
curl --fail-with-body -X POST "$base/aegis/protect-text" \
  -H 'content-type: application/json' \
  -H 'x-api-key: <API_KEY>' \
  --data '{"text":"Korunacak örnek belge.","aiTrapMode":"off"}'
```

Yanıtta `protectedText`, `variantHash`, `protectionHash`, `replacementCount`, `replacements` ve katman özetleri bulunur. Hashler ve korunan metin yetkili müşteri/girdi için deterministiktir; bu belge uydurma değer yayımlamaz.

### Gelen metni geri okuma ve inceleme

`analyze-text` admin korumalıdır. Aday listesi taramayı sınırlar; tek başına sahiplik yetkisi değildir.

```bash
curl --fail-with-body -X POST "$base/aegis/analyze-text" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  --data '{"text":"Gelen çalışma kopyası metni.","scanHoneytokens":true}'
```

`primarySuspect`, `vaultVerification`, kanal skorları ve kademeli kararı birlikte okuyun. Benzerlik veya aday tek başına tam kayıt/imza doğrulaması değildir.

## Görsel, ses ve bağımsız video

Güncel OpenAPI ürün düzeyinde kamu görsel mühürle/oku veya ses çiftini sunmaz. Ürün paketi ses/video laboratuvar yollarını kapatır. Bu işlemler için sahte HTTP isteği uydurmayın.

Doğrulanmış medya runtime'ından sonra yayımlanan doğrulama programlarını kullanın:

```sh
pnpm run test:physical-text-image
pnpm run test:physical-audio
pnpm run test:media-runtime
```

OpenAPI'daki doğrudan video lab rotaları geliştirme sözleşmesidir. `dist-product` içinde `POST /api/aegis/video-lab/encode` HTTP `410` ve false güvenlik alanları döndürür. Doğrudan kanonik okuyucu da `410` olur; onu yalnız doğrulanmış sunucu içi Live zinciri kullanır.

## Yerel korumalı Live

Aşağıdaki sıra tek-tenant fallback kullanır: `x-admin-token` ve tam eşleşen `x-tancmark-live-tenant-id`. Doğrulanmış API istemcisi de tenant yetkisi olabilir; çelişen tenant başlığı bulunamadı gibi gizlenir.

Revision değerlerini ve kimlik placeholder'larını hemen önceki yanıttan alın. Başlatma ve durdurma komutlarından önce bu sayıyı Bash `revision` değişkenine atayın. Aynı idempotency key'i farklı içerikle kullanmayın.

### 1. Hazırlık durumu

```bash
curl --fail-with-body "$base/tancmark/live/local/v1/status" \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant"
```

Korumalı oturumdan önce false olan her hazırlık alanını çözün.

### 2. Korumalı oturum oluşturma

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{"legalHold":false,"protectionMode":"PROTECTED_TANCMARK"}'
```

Yanıt `{ "session": ... }` biçimindedir. `session.sessionId` ve `session.revision` değerlerini saklayın. Kimlik yetkisini sunucu oluşturur; gövde beklenen kimlik, tenant, kayıt, harita veya imza içeremez.

### 3. H.264/AAC CMAF init yükleme

```bash
session='<SESSION_ID>'
init_sha=$(sha256sum ./init.mp4 | cut -d' ' -f1)
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/init" \
  -H 'content-type: application/octet-stream' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: init-example-0001' \
  -H "x-content-sha256: $init_sha" \
  --data-binary @./init.mp4
```

Dosya gerçek ve geçerli AVC fragmented-MP4 init parçası olmalıdır. Rastgele byte reddedilir.

### 4. Oturumu başlatma

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/start" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: start-example-0001' \
  --data "{\"expectedRevision\":${revision:?init yanıtındaki revision değerini ayarlayın}}"
```

### 5. Sıralı CMAF parçalarını ekleme

```bash
segment_sha=$(sha256sum ./segment-0.m4s | cut -d' ' -f1)
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/segments" \
  -H 'content-type: application/octet-stream' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: segment-example-0000' \
  -H "x-content-sha256: $segment_sha" \
  -H 'x-segment-sequence: 0' \
  -H 'x-segment-duration-ms: 4000' \
  --data-binary @./segment-0.m4s
```

Sunucu parçayı çözer ve süreyi çapraz denetler; çözülen süre yetkilidir. Yayımlamadan önce korumalı sonucu bekleyin. Worker veya doğrulama hatasında mühürsüz byte'a geri dönmeyin.

### 6. Durdurma ve tamamlama

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/stop" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  -H 'x-idempotency-key: stop-example-0001' \
  --data "{\"expectedRevision\":${revision:?önceki yanıttaki revision değerini ayarlayın}}"
```

Yanıt oturum, durdurma makbuzu, destek kanıtı ve arındırılmış nihai doğrulamayı içerir. `VIDEO_LAYER_VAULT` ancak fiziksel tam okuma, kayıt, tenant/hesap, imza ve tekil kayıt denetimleri birlikte geçerse oluşabilir.

### 7. Tamamlanmış exact kararı okuma

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/verify-exact-id" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{}'
```

Endpoint beklenen ID kabul etmez. Sunucunun sahip olduğu bağdan üretilmiş sonucu döndürür; tamamlanmadan önce tahmin yerine `409` verir.

### 8. Tarayıcı playback yetkisi

```bash
curl --fail-with-body -X POST "$base/tancmark/live/local/v1/sessions/$session/access-token" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{"viewerSubject":"viewer-001","ttlSeconds":120,"resourceScopes":["player","manifest","init","media-json","segment"]}'
```

Dönen tokenı aynı origin üzerinde bir kez exchange edin. Yanıt oturuma özel `HttpOnly`, `SameSite=Strict` cookie ayarlar; cookie değeri JSON'da dönmez.

```bash
curl --fail-with-body -c ./tancmark-cookie.txt -X POST "$base/tancmark/live/local/v1/access/exchange" \
  -H 'content-type: application/json' \
  --data '{"token":"<ACCESS_TOKEN>"}'
```

Cookie dosyasını koruyup oturumdan sonra silin. Token veya cookie'yi loglamayın.

## C2PA

C2PA istekleri aynı admin ve doğrulanmış tenant başlıklarını ister. `assetName` ile `outputName` yapılandırılmış tenant kökü içindeki adlardır; rastgele dosya yolu değildir.

### İnceleme ve doğrulama

```bash
curl --fail-with-body -X POST "$base/tancmark/c2pa/v1/inspect" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{"assetName":"working-copy.png"}'
```

Doğrulama için `inspect` yerine `verify` kullanın. İkisi de arındırılmış sonuç döndürür. Kriptografik geçerlilik ile sertifika güveni ayrıdır. `VALID_BUT_UNTRUSTED`, yerel test manifestinin kriptografik olarak geçerli fakat kamuda güvenilir olmadığını gösterebilir.

### Yeni manifest oluşturup gömme

```bash
curl --fail-with-body -X POST "$base/tancmark/c2pa/v1/sign-embed" \
  -H 'content-type: application/json' \
  -H "x-admin-token: $admin" \
  -H "x-tancmark-live-tenant-id: $tenant" \
  --data '{
    "assetName":"working-copy.png",
    "outputName":"working-copy-signed.png",
    "intent":"CREATE",
    "digitalSourceType":"http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation",
    "registryRecordId":"record-001",
    "recordVersion":"1",
    "algorithmVersion":"1",
    "createdAt":"2026-09-01T12:00:00.000Z"
  }'
```

Gerçek güncel UTC zamanı kullanın. Örnek tarih yalnız zorunlu ISO biçimini gösterir. `outputName` önceden bulunmamalıdır; girdi dosyasının üstüne yazılmaz.

`EDIT` ve `UPDATE` için `digitalSourceType` alanını çıkartın; verilirse hata olur. Ham anahtar, sertifika, yol, tenant/client ID, tam ID, kayıt satırı, harita, trust anchor, TSA veya uzak manifest URL'si yasaktır.

## Hata ve güvenlik davranışı

- `400`: gövde, medya biçimi, hash veya C2PA politikası geçersiz.
- `401`: admin token, API key veya playback yetkisi yok/geçersiz.
- `403`: taşıma ya da kimlik taklidi sınırı isteği reddetti.
- `404`: rota/kayıt yok veya yanlış tenant özellikle gizlendi.
- `409`: revision, idempotency, hazırlık, belirsizlik ya da tamamlama çakışması.
- `410`: laboratuvar/doğrudan okuyucu ürün paketinde bilerek kapalı.
- `413`: istek veya medya parçası çok büyük.
- `503`: zorunlu token, anahtar veya runtime yapılandırılmamış.
- `507`: saklama veya boş alan kapısı geçmedi.

Aynı idempotency key ile farklı içerik tekrar göndermeyin. Hiçbir hatayı sahiplik sonucuna dönüştürmeyin. [Sorun Giderme](TROUBLESHOOTING_TR.md) belgesine bakın.
