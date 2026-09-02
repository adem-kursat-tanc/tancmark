// AEGIS Faz 4 Kalibrasyon — Türkçe Korpus v1
// 100 cümle: 30 Hukuk, 30 Teknik, 20 Savunma-stili (sentetik), 20 Günlük/Haber.
// Cümle uzunluğu hedefi: 8-30 kelime.

export const CORPUS_TR_V1 = [
  // === 30 HUKUK ===
  { id: "L01", category: "hukuk", text: "Bu sözleşme tarafların karşılıklı yükümlülüklerini ve uyuşmazlık halinde uygulanacak hukuku açıkça düzenler." },
  { id: "L02", category: "hukuk", text: "Sanık ifadesinde olayla herhangi bir ilgisi olmadığını ısrarla beyan etmiştir." },
  { id: "L03", category: "hukuk", text: "Mahkeme delillerin yetersizliği gerekçesiyle sanığın beraatine karar vermiştir." },
  { id: "L04", category: "hukuk", text: "Davalı şirket yükümlülüklerini sözleşmede belirtilen sürede yerine getirmemiştir." },
  { id: "L05", category: "hukuk", text: "Tanık ifadesi olayın aydınlatılmasında belirleyici bir rol oynamıştır." },
  { id: "L06", category: "hukuk", text: "Avukat müvekkilinin haklarını korumak için gerekli tüm hukuki yollara başvurmuştur." },
  { id: "L07", category: "hukuk", text: "Yargıtay kararı ile yerel mahkemenin verdiği hüküm bozulmuş ve dosya iade edilmiştir." },
  { id: "L08", category: "hukuk", text: "Tarafların uzlaşma talebi hakim tarafından kabul edilerek dava düşmüştür." },
  { id: "L09", category: "hukuk", text: "Kira sözleşmesinin feshi için yasal ihtarnamenin tebliğ edilmesi zorunludur." },
  { id: "L10", category: "hukuk", text: "İş kanununa göre işveren çalışanının kıdem tazminatını eksiksiz ödemekle yükümlüdür." },
  { id: "L11", category: "hukuk", text: "Suçun kanıtlanması için maddi delillerin toplanması ve uzman raporlarının hazırlanması gerekir." },
  { id: "L12", category: "hukuk", text: "Velayet davasında çocuğun üstün yararı belirleyici esas olarak kabul edilmiştir." },
  { id: "L13", category: "hukuk", text: "İdari işlemin iptali için açılan davada zaman aşımı süresi altmış gündür." },
  { id: "L14", category: "hukuk", text: "Vekaletname noter huzurunda düzenlenmiş ve imza onayı yapılarak müvekkile teslim edilmiştir." },
  { id: "L15", category: "hukuk", text: "Tüketici hakem heyeti ürünün ayıplı olduğuna ve iadenin yapılması gerektiğine hükmetmiştir." },
  { id: "L16", category: "hukuk", text: "Marka tescili başvurusu Türk Patent ve Marka Kurumu tarafından detaylı incelemeye alınmıştır." },
  { id: "L17", category: "hukuk", text: "Miras paylaşımı tereke tespit davası sonuçlandıktan sonra mirasçılar arasında yapılacaktır." },
  { id: "L18", category: "hukuk", text: "Anayasa Mahkemesi bireysel başvuru yolu temel hak ihlallerinin tespiti için açıktır." },
  { id: "L19", category: "hukuk", text: "Boşanma davasında nafaka miktarı eşlerin gelir durumu dikkate alınarak belirlenmiştir." },
  { id: "L20", category: "hukuk", text: "Ceza muhakemesinde sanığın susma hakkı anayasal güvence altına alınmış temel bir haktır." },
  { id: "L21", category: "hukuk", text: "İcra dairesi alacaklının talebi üzerine borçlunun mal varlığı üzerine haciz koymuştur." },
  { id: "L22", category: "hukuk", text: "Bilirkişi raporunda olayın teknik nedenleri ayrıntılı şekilde açıklanmıştır." },
  { id: "L23", category: "hukuk", text: "Hukuki danışmanlık hizmeti almadan yapılan sözleşmeler ileride ciddi mağduriyet doğurabilir." },
  { id: "L24", category: "hukuk", text: "İdare mahkemesi kamulaştırma bedelinin yetersiz olduğu yönündeki itirazı haklı bulmuştur." },
  { id: "L25", category: "hukuk", text: "Vergi yargısında uzlaşma yolu mükellef için önemli bir hukuki imkan sunmaktadır." },
  { id: "L26", category: "hukuk", text: "Trafik kazasında kusur oranı düzenlenen bilirkişi raporuyla net biçimde belirlenmiştir." },
  { id: "L27", category: "hukuk", text: "Sigorta şirketi poliçe kapsamı dışındaki hasar talebini gerekçe göstererek reddetmiştir." },
  { id: "L28", category: "hukuk", text: "Şirket yönetim kurulu kararıyla genel kurul toplantısının ertelenmesi resmen onaylanmıştır." },
  { id: "L29", category: "hukuk", text: "Tapu iptal davasında usulsüz devirlerin iyi niyetli üçüncü kişileri etkilemediği vurgulanmıştır." },
  { id: "L30", category: "hukuk", text: "İş mahkemesi haksız fesih tespiti üzerine işçinin işe iade edilmesine hükmetmiştir." },

  // === 30 TEKNİK ===
  { id: "T01", category: "teknik", text: "Sistem yüksek erişilebilirlik için yedekli sunucularla ve yük dengeleyiciyle birlikte çalışmaktadır." },
  { id: "T02", category: "teknik", text: "Veritabanı sorgularının performansı uygun indeks tasarımıyla önemli ölçüde iyileştirilebilir." },
  { id: "T03", category: "teknik", text: "Mikroservis mimarisi büyük sistemlerin bakımını ve ölçeklenmesini kolaylaştıran bir yaklaşımdır." },
  { id: "T04", category: "teknik", text: "API uç noktaları yetkisiz erişimlere karşı OAuth iki nokta sıfır ile korunmaktadır." },
  { id: "T05", category: "teknik", text: "Konteyner orkestrasyonu Kubernetes üzerinde yaml manifestleriyle deklaratif olarak tanımlanır." },
  { id: "T06", category: "teknik", text: "İstek başına ortalama gecikme yüz yirmi milisaniye olarak metrik panelde raporlanmaktadır." },
  { id: "T07", category: "teknik", text: "Önbellek katmanı sık erişilen veriyi hızlıca sunarak veritabanı yükünü azaltır." },
  { id: "T08", category: "teknik", text: "Sürekli entegrasyon hattı her komiti otomatik test ve statik analizden geçirir." },
  { id: "T09", category: "teknik", text: "Olay güdümlü mimaride mesaj kuyruğu üreticileri ve tüketicileri zaman bağımsız şekilde ayırır." },
  { id: "T10", category: "teknik", text: "TLS sertifikasının süresi dolmadan otomatik yenileme görevi cron ile planlanmıştır." },
  { id: "T11", category: "teknik", text: "Loglar yapısal JSON formatında merkezi log toplayıcıya akıtılır ve saklanır." },
  { id: "T12", category: "teknik", text: "Kod gözden geçirme süreci güvenlik açıklarının erken tespit edilmesi için kritiktir." },
  { id: "T13", category: "teknik", text: "Veri şeması göçleri geri alınabilir migration dosyalarıyla versiyon kontrolüne dahil edilir." },
  { id: "T14", category: "teknik", text: "Statik tip kontrolü çalışma zamanı hatalarını derleme aşamasında yakalamaya yardımcı olur." },
  { id: "T15", category: "teknik", text: "Yedekleme stratejisi tam ve artımlı yedeklerin birlikte alınmasını içermelidir." },
  { id: "T16", category: "teknik", text: "Akış işleme platformu saniyede yüz binlerce olayı düşük gecikmeyle işleyebilmektedir." },
  { id: "T17", category: "teknik", text: "Servis mesh trafiği şifreleme ve gözlemlenebilirlik açısından merkezi politikayla yönetir." },
  { id: "T18", category: "teknik", text: "İçerik dağıtım ağı statik varlıkların kullanıcıya en yakın kenardan sunulmasını sağlar." },
  { id: "T19", category: "teknik", text: "Bellek sızıntısı uzun süre çalışan süreçlerde kademeli performans düşüşüne neden olur." },
  { id: "T20", category: "teknik", text: "Kimlik doğrulama belirteçleri kısa ömürlü tutulup yenileme akışıyla rotasyona alınmıştır." },
  { id: "T21", category: "teknik", text: "Veritabanı replikasyonu okuma yükünü birden çok düğüme dağıtarak ölçeklenebilirlik sunar." },
  { id: "T22", category: "teknik", text: "Mesaj kuyruğunda artan birikim tüketici servisinin yetersiz kapasitede çalıştığını göstermektedir." },
  { id: "T23", category: "teknik", text: "Sızma testleri sistemin gerçek bir saldırı senaryosuna karşı dayanıklılığını ölçer." },
  { id: "T24", category: "teknik", text: "Kod kapsamı yüzde sekseninin altına düştüğünde otomatik bir uyarı oluşturulmaktadır." },
  { id: "T25", category: "teknik", text: "Servis kesintisi yedekli düğümler arasında otomatik yük devri sayesinde kullanıcıya yansımamıştır." },
  { id: "T26", category: "teknik", text: "Şema ilk yaklaşımı ile API sözleşmesi istemci ve sunucu için ortak doğruluk kaynağı olur." },
  { id: "T27", category: "teknik", text: "Gizli anahtarların kod tabanına gömülmesi güvenlik denetiminde kritik bulgu olarak işaretlenir." },
  { id: "T28", category: "teknik", text: "Eşzamanlılık problemleri uygun kilit ve atomik işlemlerle güvenli biçimde çözülmelidir." },
  { id: "T29", category: "teknik", text: "Gözlemlenebilirlik metrik log ve iz verilerinin birlikte değerlendirilmesini gerektirir." },
  { id: "T30", category: "teknik", text: "Önyüz performansı kritik render yolundaki engelleyici kaynakların azaltılmasıyla iyileşir." },

  // === 20 SAVUNMA-STİLİ (sentetik) ===
  { id: "D01", category: "savunma", text: "Sınır bölgesindeki tatbikat senaryosunda hava ve kara unsurları eşgüdümlü hareket etmiştir." },
  { id: "D02", category: "savunma", text: "Komuta merkezi gelen sinyal verilerini gerçek zamanlı olarak değerlendirip durum raporu hazırlamıştır." },
  { id: "D03", category: "savunma", text: "İnsansız hava aracı planlanan rotayı tamamlayıp üsse güvenle iniş yapmıştır." },
  { id: "D04", category: "savunma", text: "Görev brifinginde hedef bölgenin coğrafi özellikleri ve risk haritası ayrıntılı paylaşıldı." },
  { id: "D05", category: "savunma", text: "Konvoy hareketinden önce güzergah üzerinde keşif unsurları ön incelemeyi tamamlamıştır." },
  { id: "D06", category: "savunma", text: "Şifreli haberleşme kanalı tüm taktik birimler arasında kesintisiz olarak sağlanmıştır." },
  { id: "D07", category: "savunma", text: "Lojistik destek planı görev süresince yakıt ve mühimmat ikmalini güvence altına almaktadır." },
  { id: "D08", category: "savunma", text: "Saha komutanı değişen hava koşullarına göre tatbikat takvimini revize etmek durumunda kaldı." },
  { id: "D09", category: "savunma", text: "Sahil koruma birimi şüpheli teknenin radar izini sürekli takip altında tutmuştur." },
  { id: "D10", category: "savunma", text: "Tatbikatın değerlendirme oturumunda her birimin görev performansı ayrı ayrı analiz edildi." },
  { id: "D11", category: "savunma", text: "Yer istasyonu uydu görüntülerini işleyip hassas hedef listesine ekleme yapmıştır." },
  { id: "D12", category: "savunma", text: "Operasyon planı düşman unsurlarının olası tepkilerini de senaryo bazlı içermektedir." },
  { id: "D13", category: "savunma", text: "Zırhlı araç birliği belirtilen koordinatlara planlanan zaman penceresinde ulaşmayı başarmıştır." },
  { id: "D14", category: "savunma", text: "Elektronik harp unsurları bölgedeki düşman radar emisyonlarını başarıyla bastırmıştır." },
  { id: "D15", category: "savunma", text: "Pilot eğitiminde simülasyon saati gerçek uçuş saati ile dengeli oranda planlanmaktadır." },
  { id: "D16", category: "savunma", text: "Asayiş timi şehir içi devriye görevini önceden belirlenmiş güzergaha bağlı sürdürmüştür." },
  { id: "D17", category: "savunma", text: "Kriz masası tüm paydaş kurumların temsilcilerinin katılımıyla yedi yirmi dört aktiftir." },
  { id: "D18", category: "savunma", text: "Helikopter intikalleri olumsuz hava koşulları nedeniyle bir sonraki güne ertelenmiştir." },
  { id: "D19", category: "savunma", text: "Nöbet değişimi sırasında devir teslim raporları yazılı olarak imza karşılığı kayda geçirilir." },
  { id: "D20", category: "savunma", text: "Görev sonrası durum değerlendirme toplantısında elde edilen dersler doktrine eklenecektir." },

  // === 20 GÜNLÜK / HABER ===
  { id: "N01", category: "gunluk", text: "Bugün hava güneşli ve sıcaklığın on beş derece civarında seyretmesi beklenmektedir." },
  { id: "N02", category: "gunluk", text: "İstanbul boğazında akşam saatlerinde gemi trafiği yoğun bir şekilde devam etmektedir." },
  { id: "N03", category: "gunluk", text: "Süper lig maçında ev sahibi takım son dakikada attığı golle galibiyeti kaptı." },
  { id: "N04", category: "gunluk", text: "Yeni eğitim yılı için okulların hazırlıkları il genelinde hızla tamamlanmaktadır." },
  { id: "N05", category: "gunluk", text: "Borsa endeksi günü yüzde bir buçuk yükselişle ve yüksek işlem hacmiyle kapatmıştır." },
  { id: "N06", category: "gunluk", text: "Belediye merkez ilçelerde park ve yeşil alan sayısını artırmayı hedeflediğini açıkladı." },
  { id: "N07", category: "gunluk", text: "Kültür merkezinde açılan yeni sergi sanatseverlerin yoğun ilgisiyle karşılanmıştır." },
  { id: "N08", category: "gunluk", text: "Sebze ve meyve fiyatları mevsim geçişi nedeniyle haller ve marketlerde değişkenlik göstermektedir." },
  { id: "N09", category: "gunluk", text: "Sahile yakın ilçelerde turizm sezonu erken başladı ve oteller dolulukta artış bildirdi." },
  { id: "N10", category: "gunluk", text: "Sağlık bakanlığı bu sabah grip vakalarına ilişkin yeni haftalık raporu kamuoyuyla paylaştı." },
  { id: "N11", category: "gunluk", text: "Üniversite sınavına hazırlanan öğrenciler için ücretsiz deneme sınavları bu hafta sonu yapılacak." },
  { id: "N12", category: "gunluk", text: "Şehir içi toplu taşımada yeni hat düzenlemesi yarın itibarıyla yürürlüğe girecektir." },
  { id: "N13", category: "gunluk", text: "Çiftçiler kuraklık nedeniyle sulama altyapısının acilen güçlendirilmesini talep etmektedir." },
  { id: "N14", category: "gunluk", text: "Geri dönüşüm kampanyasına katılan mahalleler bu ay rekor miktarda ambalaj atığı topladı." },
  { id: "N15", category: "gunluk", text: "Hafta sonu düzenlenen yarı maraton koşusuna binlerce sporcu yurt genelinden katılım sağladı." },
  { id: "N16", category: "gunluk", text: "Kentteki trafik akışı sabah ve akşam yoğun saatlerde belirgin biçimde yavaşlamaktadır." },
  { id: "N17", category: "gunluk", text: "Müze ziyaretçi sayıları geçen yıla göre yüzde otuz artış gösterdiği açıklandı." },
  { id: "N18", category: "gunluk", text: "Yerel pazarda mevsim ürünlerinin fiyatları hafta başına göre kısmen geriledi." },
  { id: "N19", category: "gunluk", text: "Köyde kurulan kütüphane çocuklara ücretsiz kitap erişimi imkanı sunmaya başladı." },
  { id: "N20", category: "gunluk", text: "Hafta içi düzenlenen kitap fuarı yazarların okurlarla bir araya gelmesine vesile oldu." },
];

export function corpusStats() {
  const counts = { hukuk: 0, teknik: 0, savunma: 0, gunluk: 0 };
  let minW = Infinity, maxW = 0, sumW = 0;
  for (const c of CORPUS_TR_V1) {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
    const w = c.text.split(/\s+/).filter(Boolean).length;
    if (w < minW) minW = w;
    if (w > maxW) maxW = w;
    sumW += w;
  }
  return {
    total: CORPUS_TR_V1.length,
    byCategory: counts,
    wordCount: { min: minW, max: maxW, mean: +(sumW / CORPUS_TR_V1.length).toFixed(2) },
  };
}
