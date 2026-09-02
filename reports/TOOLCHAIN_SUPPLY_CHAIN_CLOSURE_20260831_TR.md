# TancMark Toolchain ve C2PA ZIP Güvenlik Kapanışı

Bu çalışma yalnız kurulum aracı ile C2PA native ZIP okuma yolunu değiştirdi. Metin, görsel, ses, video, Live, C2PA manifesti, kimlik, eşik, registry, imza, sahiplik, VAULT, DNA ve Chief Brain ürün kaynakları değişmedi.

## Sonuç

- pnpm `10.23.0` yerine resmî kaynak, npm tarball bütünlüğü ve güncel advisory kayıtları doğrulanmış `10.34.5` kullanılıyor.
- Kök ve geçişli tüm `unzipper` çözümü `0.12.5` olarak tekleştirildi. Npm paketi, yayıncının kaynak commit'i ve Zip Slip düzeltme commit'iyle eşleşiyor.
- TancMark yine genel ZIP çıkarma yapmıyor. Yalnız bellekte tek bir `index.node` kabul ediliyor; ad, tür, arşiv ve binary boyutu, SHA-256, ZIP metadata, CRC ve sıkıştırma oranı doğrulanıyor.
- 33 kötü arşiv ve kurulum yarışı senaryosunun tamamı güvenli biçimde reddedildi. Dışarı yazma, beklenmeyen dosya kabulü ve kalan geçici klasör sayısı sıfır.
- Gerçek Windows C2PA arşivi, çevrimiçi kurulum, çevrimdışı kurulum ve `verify-only` geçti.
- C2PA işlev testleri 17/17, üretilen kod tekrarı 186/186, typecheck, normal build, product build, public testler, belge ve workflow kapıları geçti.
- SBOM 1.129 paketi kapsıyor; beyan edilmiş lisansı çözülemeyen paket sayısı sıfır. Bu hukuki onay iddiası değildir.

Ham dependency audit sonucu, kabul edilmiş V4 ölçümüyle aynı kaldı: 24 high, 16 moderate ve 3 low. Önceki reachability kanıtında üretimde erişilebilir critical/high sıfırdı. Bu görevde düzeltilen pnpm ve unzipper için seçili sürümü etkileyen critical/high advisory sayısı ayrıca sıfır ölçüldü.

Push, tag, release veya deploy yapılmadı. Son yayın kararı proje sahibine aittir.
