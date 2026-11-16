# Hlas ze spotu u zápasu

Otevři **Detail zápasu → Komentář → ⚙ → Hlas komentáře → Hlas ze spotu**. Po stisku **Spustit** se poprvé stáhne přibližně 400 MB. Po přepnutí zpět na hlas zařízení se specializovaný přehrávač uvolní. Prohlížeč může stažené soubory uložit do své mezipaměti.

Volba používá český režim Supertonic 3 a stejný mužský preset M2 jako reklamní spot. Přečte text skutečných událostí v živém režimu i při přehrávání od začátku. Syntéza probíhá v odděleném vlákně prohlížeče. Po internetu se stahují soubory modelu a runtime, text zápasu zůstává v zařízení. Při chybě se přehrávač pokusí pokračovat hlasem zařízení a zobrazí stav.

- [Supertonic 3 – model a OpenRAIL-M](https://huggingface.co/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323)
- [Supertonic – webová implementace](https://github.com/supertone-oss-archive/supertonic/tree/1e9799e964ea4c0dad7cde993b65c3c813a7b373/web) (MIT, kopie licence v `voice/SUPERTONIC-MIT.txt`)
- [ONNX Runtime Web 1.22.0](https://github.com/microsoft/onnxruntime/releases/tag/v1.22.0) (MIT)

Na slabších telefonech může syntéza nabíhat pomaleji nebo selhat kvůli dostupné paměti. Doporučené první spuštění je přes Wi-Fi. Hlas zařízení zůstává výchozí.
