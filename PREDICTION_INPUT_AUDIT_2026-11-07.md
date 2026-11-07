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
