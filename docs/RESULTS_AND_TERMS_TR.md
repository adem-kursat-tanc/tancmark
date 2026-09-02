# TancMark Sonuçları ve Terimler

Bu belge kamu kılavuzları ile kanıtların merkez sözlüğüdür. Pozitif destek sinyali kendiliğinden kimlik veya sahiplik sonucu değildir.

## Dört işlem

- **SEAL (mühürle):** Çalışma kopyasına deterministik kimlik veya destek izi göm.
- **RECOVER (geri oku):** Gelen kopyadaki fiziksel mühür/kimlik sinyalini oku.
- **MATCH (eşleştir):** Okunan kanıtı yetkili kayıt veya sınırlı aday havuzuyla karşılaştır.
- **VERIFY (doğrula):** Tekil kayıt, tenant/hesap bağı ve dijital imzayı denetle.

Güvenli zincir `SEAL -> RECOVER -> MATCH -> VERIFY` biçimindedir. `VERIFY` atlanırsa fiziksel kanıt tam yetki kazanmaz.

## Sonuç sınıfları

| Sonuç | Anlamı | Otomatik sahiplik |
| --- | --- | --- |
| `EXACT` | Tam fiziksel kimlik ve gerekli bütün yetki denetimleri eşleşti. | Yalnız doğrulanan modül kapsamı içinde. |
| `PARTIAL` | Yararlı fiziksel kanıt bulundu fakat tam zincir tamamlanmadı. | Hayır. |
| `MANUAL_REVIEW` | Kanıt belirsiz, çelişkili veya birden fazla kayda gidiyor. | Otomatik sonuç yok. |
| `NOT_FOUND` | Gerekli fiziksel kanıt okunamadı. | Hayır. |
| `FAIL-CLOSED` | Zorunlu güvenlik şartı yoktu; sistem tahmin etmeden durdu. | Hayır. |

Ürün `VIDEO_LAYER_VAULT`, `AUDIO_LAYER_MATCH` veya `CANDIDATE_SUPPORT_ONLY` gibi daha özel adlar kullanabilir. Bunları aynı yetki zinciri ve modül kapsamıyla yorumlayın.

## Kesin yetki zinciri

Yetkili modül sonucu için ilgili bütün şartlar gerekir:

1. Tam fiziksel modül kimliği exact okundu.
2. Tek bir kayıt eşleşti.
3. Doğru tenant ve gerekiyorsa hesap bağı doğrulandı.
4. Kayıt dijital imzası geçerli.
5. Belirsizlik, çelişen kayıt veya fail-closed politika ihlali yok.

Videoda Channel A kesin kanaldır; Channel B destek tanığıdır. Channel B, 32-bit L3 locator, imzalı zaman haritası, DNA, ECC veya benzerlik tek başına sahiplik açamaz. Kısa locator bir kovayı arar; şifreleme anahtarı değildir ve farklı kayıtlarda tekrarlanabilir.

## Sonucun kapsamı

- Metin exact kanıtı yetkili metin kaydına aittir.
- Görsel exact kanıtı ilgili okuyucunun ölçtüğü görsel katmana aittir.
- Ses exact kanıtı sese aittir; videonun görüntüsüne sahiplik vermez.
- Video exact kanıtı fiziksel video katmanı ve doğrulanmış kayıt zincirine aittir.
- Aynı kayıtlı exact ses ve video çok-kanallı sonucu destekleyebilir.
- Farklı exact ses/video kayıtları mixed-media provenance ve insan incelemesi üretir.
- Live nihai exact sonucu durmuş korumalı kayıt ve sunucunun oturum bağına aittir.

## Modüllere göre kör okuma

“Blind/kör”, mühürsüz orijinalin okuyucuya verilmemesi demektir. Okuyucuya hiçbir kimlik, anahtar, aday veya adres girdisi verilmediği anlamına gelmez.

| Modül/okuma yolu | Orijinal veriliyor mu? | Beklenen kimlik/adayı veriliyor mu? | Uzunluk/biçim biliniyor mu? | Konum/harita veriliyor mu? | Referans özeti veriliyor mu? | Doğru kamu tanımı |
| --- | --- | --- | --- | --- | --- | --- |
| Metin canary round trip | Hayır | Hedefli doğrulama için belge kimliği/anahtar verilir | Canary biçimi bilinir | Hayır | Hayır | Anahtarlı hedefli kör okuma |
| Metin zero-width fingerprint | Hayır | Aday müşteri havuzu verilir | Çekirdek bit uzunluğu/kanallar bilinir | Hayır | Hayır | Aday havuzlu kör eşleştirme |
| Kamu görsel aritmetik smoke | Bilgili okuyucu referans patch kullanır | Beklenen payload verilir | Anchor ve payload biçimi bilinir | Anchor düzeni/referans patch verilir | Evet | Informed; tam kör değil |
| Diğer görsel araştırma okuyucuları | Kör modda orijinal yok; bazı modlar informed | Beklenen payload/anahtar verilebilir | Taşıyıcı düzeni bilinir | Geometri veya imzalı adres verilebilir | İlan edilen moda göre | Her sonuç blind, informed veya geometry-guided diye yazılır |
| Ses karar yolu | Hayır | Beklenen 32-bit payload verilir | Payload uzunluğu bilinir | Orijinal yok; uygulamanın taşıyıcı planı bilinir | Hayır | Hedefli beklenen-payload okuması |
| Video Primary | Hayır | Sunucunun sahip olduğu tam beklenen ID verilir | Kanal/payload tasarımı bilinir | İmzalı harita hızlı yol seçebilir; fallback fiziksel arar | Kayıt/imza medyanın yerine değil, okumadan sonra doğrulamada kullanılır | Harita yönlendirmeli veya VFR-safe hedefli exact okuma |
| Live dönemsel/nihai okuma | Hayır | Sunucunun oturum bağı/tam ID'si verilir | Kanal tasarımı bilinir | Adresleme için imzalı rolling map verilir | Kayıt, tenant/hesap ve imza doğrulama için verilir | Sunucu içi hedefli exact okuma |

Kamu görsel smoke'u genel “tam kör görsel okuyucu” iddiasını desteklemez. Her medya sonucu gerçek okuma biçimini yazmalıdır.

## Locator, aday ve çakışma

32-bit locator kısa bir indekstir. Büyük kayıt havuzunu aday kovasına indirir. Yaklaşık 4,29 milyar değer bulunduğu için iki bağımsız kayıt aynı locator'a sahip olabilir. Bu, şifreleme bozuldu demek değildir; kısa indeksin kimlik için tekil olmaması demektir.

Güvenli davranış:

- Kova eşleşmesi yok: aramaya devam et veya `NOT_FOUND`.
- Tek aday: tam güçlü fiziksel kanıt ve kayıt/imza doğrulamasını yap.
- Birden fazla aday: `MANUAL_REVIEW`; hiçbirini otomatik seçme.
- Yalnız locator: `CANDIDATE_SUPPORT_ONLY`.

## Haritalar ve makbuzlar

İmzalı exact/zaman haritası adresleme ve bütünlük aracıdır. Okumayı hızlandırıp sinyalin nereye koyulduğunu gösterebilir. Kimlik yetkisi değildir. Crop, trim, kare kaybı veya yeniden zamanlama exact haritayı bozarsa fiziksel fallback kullanılabilir. Harita uyuşmazlığı gerçek fiziksel exact eşleşmeyi kendiliğinden silmez; harita tek başına da sonuç oluşturmaz.

Taşıma makbuzu kendi kapsamındaki taşıma/saklama gerçeğini gösterir. Fiziksel filigran veya sahiplik kanıtlamaz.

## C2PA terimleri

- `NO_C2PA`: gömülü C2PA bilgisi yok.
- `VALID_BUT_UNTRUSTED`: manifest kriptografik geçerli olabilir, kamu sertifika güveni kurulmadı.
- `VALID_AND_TRUSTED`: kriptografik ve yapılandırılmış güven denetimi geçti.
- `VALID_AND_TRUSTED_TEST_CONTEXT`: güven yalnız açık yerel test bağlamında.
- `INVALID_SIGNATURE`: imza doğrulaması geçmedi.
- `ASSET_TAMPERED`: dosya manifest bağıyla artık eşleşmiyor.
- `MALFORMED_MANIFEST`: manifest güvenle çözülemedi.
- `UNSUPPORTED_FORMAT`: ürün politikası formatı reddetti.
- `REMOTE_MANIFEST_BLOCKED`: uzak okuma reddedildi.
- `TRUST_STATUS_NOT_MEASURED`: gerekli güven kararı ölçülmedi.

Hiçbiri TancMark VAULT açmaz veya hukuki sahiplik oluşturmaz.

## DNA, Chief Brain ve Discovery

- **DNA:** Modül, kanıt ve uyumluluk için yapılandırılmış danışman bilgi; exact kararı geçersiz kılamaz.
- **Chief Brain:** İnceleme/öneri koordinasyonu; `autoApply=false`, kontrollü değişiklikte sahip onayı ve exact hash gerekir.
- **Discovery:** Dış arama/tespit adayı; yine yetkili fiziksel exact kanıt ve kayıt/imza ister.
- **Destek kanıtı:** İncelemeye yararlı ama sahiplik için yetersiz bilgi.

## Kanıt kaydı kontrol listesi

Her sonuç için modül/sürüm, özel tutulan kaynak ve gelen kopya checksumı, dönüşüm hücresi, okuma modu, verilen orijinal/ID/aday/harita/referans, fiziksel sonuç, kayıt/tenant/hesap/imza/tekillik, nihai sınıf ve kapsam, negatif sonuçlar ile `NOT_MEASURED` sınırlarını kaydedin.

Sonucu gördükten sonra ölçüm etiketini değiştirmeyin. Kısmi kanalı exact, simülasyonu gerçek telefon çekimi veya yerel test sertifikasını kamu güveni diye yazmayın.
