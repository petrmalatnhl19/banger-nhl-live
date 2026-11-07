# Audit vstupů predikčního systému BANGER NHL LIVE — 2026-11-07

## Rozsah a omezení
Kontrola zdrojového kódu `index.html`, `engine-lab.js` a `model-input-audit.js`. Jde o statickou kontrolu; backendový výpočet modelů nebyl ověřen, takže nelze tvrdit, že všechny níže uvedené faktory skutečně vstupují do finální predikce.

## Ověřené nálezy
- `index.html`: poslední forma týmů je v reportu výslovně označena „Forma se zobrazuje samostatně a nemění hlavní model.“
- `index.html`: vzorek výkonu brankářů je v reportu výslovně označen „Zatím není započteno do serverového CORE 3.1.“
- `index.html`: projekce střel má transparentní heuristiku 65 % vlastních nedávných střel + 35 % soupeřem povolených střel (`shots-v1-65-35`). Tato heuristika není sama o sobě důkazem přesnosti.
- `index.html`: existují datové metriky xG, Corsi, Fenwick a GSAx v pokročilých statistikách; je nutné rozlišit zobrazení a modelový vstup.
- `engine-lab.js`: přehled modelů CORE 3.0, experimentální xG, CORE 3.1, CORE 3.2, CORE 3.3 a SHOTS 1.0. 
- `model-input-audit.js`: existuje read-only kontrola archivovaných předzápasových projekcí, dostupnosti brankářských dat, rozdílů modelů a MAE; tento soubor sám modely nepřepočítává.

## Prioritní technické kroky
1. Zmapovat serverové zdrojové funkce pro CORE 3.0–4.1 a výslovně zdokumentovat skutečně používané vstupy, váhy, fallbacky a čas poslední aktualizace.
2. U každé predikce uložit před začátkem utkání neměnný snapshot: čas, zápas, verze modelu, vstupní data, chybějící data a predikci.
3. Po odehrání porovnat modely na **stejných zápasech**; měřit MAE/RMSE gólů a kalibraci pravděpodobností, pokud jsou predikovány.
4. Experimentálně vyhodnotit potvrzeného brankáře, GSAx, 5v5 xG, PP/PK a odpočinek. Nejdříve měřit pokrytí dat, pak přínos proti současnému CORE.
5. Nový faktor přidat do produkčního výpočtu až po pozitivním out-of-sample testu bez úniku budoucích informací.
6. Chybějící údaje označovat jako missing, ne jako nulu; vyžadovat dostatečný vzorek a uvádět kvalitu dat.

## Stav
Audit je zahájen. **Žádná váha produkčního modelu nebyla změněna**. Serverové zdroje a reálná kvalita predikcí ještě vyžadují kontrolu.


## Doplnění: ověřený serverový audit (7. 11. 2026)

Zdroj: nasazená Supabase Edge Function `nhl-prediction-collect` (verze 19), `nhl-prediction-finalize` (verze 5) a read-only SQL nad `public.nhl_prediction_archive`.

| Model | Skutečný výpočet / vstupy |
| --- | --- |
| CORE 3.0 | Průměr sezonních vstřelených gólů týmu a inkasovaných gólů soupeře, domácí faktor +1,5 % / hosté −1,5 %, omezení 0,4–6 |
| CORE 3.1 | 80 % sezonní základ, 20 % posledních až pěti zápasů (minimum 3), stejný domácí faktor |
| CORE 3.2 | Základ 3.1 (nebo 3.0) upravený podle nedávné úspěšnosti identifikovaných brankářů; malý vzorek tlumen priorními 120 střelami, násobek omezen 0,96–1,04 |
| CORE 3.3 | Základ 3.1 (nebo 3.0) + korekce podle PP a soupeřova PK z posledních až 8 zápasů, minimálně 3 validní; korekce ±0,35 gólu |
| xG 4.0 | Samostatná experimentální korekce sezonního základu pomocí 5v5 xGF/xGA, tlumení 15 zápasy, maximum ±10 % |
| CORE 4.0 | Vážená kombinace předzápasových xG4 40 %, brankáři 25 %, speciální týmy 20 %, forma 15 %; pouze dostupné předzápasové snapshoty, alespoň 2 včetně xG4 |
| CORE 4.1 | Stejná základní váhová struktura jako 4.0, ale brankářská složka vyžaduje kompletní údaje a alespoň 30 střel pro každého brankáře; chybějící složky se vyloučí a ostatní váhy normalizují |
| CORE 4.2 | Pozdní nezávislý brankářský snapshot nejvýše 12 hodin před zápasem; čerstvý feed do 6 hodin a údaje obou brankářů, jinak se nevytvoří |

**Stav archivu při kontrole:** 14 final, 30 pending, celkem 44. Všech 30 pending má CORE 4.1, xG4, CORE 3.2 a CORE 3.3. Všech 14 final má CORE 3.2 a CORE 3.3, ale žádný CORE 4.1, CORE 4.2 ani xG4. CORE 4.2 nemá zatím žádný snapshot.

**Důležitá zjištění:**
- CORE 4.1 již používá formu, xG 5v5, brankářské statistiky a PP/PK prostřednictvím podmodelů. Nelze je označovat za zcela nezapojené.
- Samostatné Corsi, Fenwick, GSAx, únava/cestování a absence hráčů nejsou prokazatelnými přímými vstupy tohoto serverového CORE 4.1.
- Předpovědi v archivu jsou verzované a nové modely se nebackfillují do starších zápasů, což chrání férové porovnání.
- Dosud **nelze doložit**, že CORE 4.1 je přesnější než starší modely; potřebuje dokončené zápasy s původními předzápasovými snapshoty.
- Při dalších úpravách je nutné zachovat neměnnost archivovaných predikcí a provést out-of-sample srovnání na stejných utkáních.

**Produkční predikční výpočty nebyly změněny.** Toto doplnění je audit a plán validace.
